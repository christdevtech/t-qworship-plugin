use crate::SourceConfig;
use headless_chrome::{Browser, LaunchOptions};
use ndi::{Send as NdiSend, SendBuilder, VideoData, FourCCVideoType, FrameFormatType};
use tauri::AppHandle;
use tokio::task::JoinHandle;
use std::time::Duration;
use std::sync::Arc;
use tauri::Emitter;
use serde::Serialize;
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Clone)]
struct StatsUpdate {
    cpu: u32,
    ram: u32,
    sources: Vec<SourceStats>,
}

#[derive(Serialize, Clone)]
struct SourceStats {
    fps: u32,
    #[serde(rename = "bitrateMbps")]
    bitrate_mbps: f64,
    active: bool,
    #[serde(rename = "previewData")]
    preview_data: String,
}

pub struct StreamManager {
    handles: Vec<JoinHandle<()>>,
    browser: Option<Browser>,
}

impl StreamManager {
    pub fn new() -> Self {
        Self {
            handles: Vec::new(),
            browser: None,
        }
    }

    pub async fn start_all(&mut self, sources: Vec<SourceConfig>, app: AppHandle) -> Result<(), String> {
        self.stop_all().await;

        let options = LaunchOptions::default_builder()
            .headless(true)
            .window_size(Some((1920, 1080)))
            .args(vec![
                std::ffi::OsStr::new("--disable-gpu"),
                std::ffi::OsStr::new("--disable-dev-shm-usage"),
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--force-device-scale-factor=1"),
            ])
            .build()
            .map_err(|e| e.to_string())?;

        let browser = Browser::new(options).map_err(|e| e.to_string())?;

        for (source_index, source) in sources.into_iter().enumerate() {
            if source.url.is_empty() {
                continue;
            }

            let tab = browser.new_tab().map_err(|e| e.to_string())?;
            tab.navigate_to(&source.url).map_err(|e| e.to_string())?;
            tab.wait_until_navigated().map_err(|e| e.to_string())?;

            // Extra wait so JS-heavy pages finish rendering
            std::thread::sleep(Duration::from_millis(500));

            // Wrap Tab in Arc to share across the blocking thread safely
            let tab = Arc::new(tab);
            let tab_clone = Arc::clone(&tab);

            let ndi_name = source.ndi_name.clone();
            let app_clone = app.clone();

            let handle = tokio::task::spawn_blocking(move || {
                let tab = tab_clone;

                let sender = SendBuilder::new().ndi_name(ndi_name.clone()).build();
                let sender: NdiSend = match sender {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("[NDI] Failed to create sender '{}': {:?}. Is the NDI SDK installed?", ndi_name, e);
                        return;
                    }
                };

                eprintln!("[NDI] Sender '{}' started successfully.", ndi_name);

                let mut frame_count = 0u32;
                let mut last_fps_check = std::time::Instant::now();
                let mut latest_preview_b64 = String::new();

                loop {
                    let start = std::time::Instant::now();

                    match tab.capture_screenshot(
                        headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
                        Some(80), // quality hint (PNG ignores quality but useful for JPEG)
                        None,
                        true, // capture from surface (enables transparency)
                    ) {
                        Ok(png_data) => {
                            // Update preview base64
                            latest_preview_b64 = format!(
                                "data:image/png;base64,{}",
                                general_purpose::STANDARD.encode(&png_data)
                            );

                            // Decode and send over NDI
                            match image::load_from_memory(&png_data) {
                                Ok(img) => {
                                    let mut rgba = img.to_rgba8();
                                    let (width, height) = rgba.dimensions();

                                    let video_data = VideoData::from_buffer(
                                        width as i32,
                                        height as i32,
                                        FourCCVideoType::RGBA,
                                        30000,
                                        1000,
                                        FrameFormatType::Progressive,
                                        0,
                                        (width * 4) as i32,
                                        None,
                                        &mut rgba,
                                    );

                                    sender.send_video(&video_data);
                                    frame_count += 1;
                                }
                                Err(e) => {
                                    eprintln!("[NDI] Image decode error for '{}': {:?}", ndi_name, e);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[NDI] Screenshot capture failed for '{}': {:?}", ndi_name, e);
                        }
                    }

                    // Emit stats + preview once per second
                    if last_fps_check.elapsed().as_secs() >= 1 {
                        let current_fps = frame_count;
                        frame_count = 0;
                        last_fps_check = std::time::Instant::now();

                        let mut sources_stats = vec![
                            SourceStats { fps: 0, bitrate_mbps: 0.0, active: false, preview_data: String::new() },
                            SourceStats { fps: 0, bitrate_mbps: 0.0, active: false, preview_data: String::new() },
                        ];
                        if source_index < sources_stats.len() {
                            sources_stats[source_index] = SourceStats {
                                fps: current_fps,
                                bitrate_mbps: 0.0,
                                active: true,
                                preview_data: latest_preview_b64.clone(),
                            };
                        }

                        let _ = app_clone.emit("stats-update", StatsUpdate {
                            cpu: 0,
                            ram: 0,
                            sources: sources_stats,
                        });
                    }

                    // Throttle to ~30 fps
                    let elapsed = start.elapsed();
                    let target = Duration::from_millis(33);
                    if elapsed < target {
                        std::thread::sleep(target - elapsed);
                    }
                }
            });

            self.handles.push(handle);
        }

        self.browser = Some(browser);
        Ok(())
    }

    pub async fn stop_all(&mut self) {
        for handle in self.handles.drain(..) {
            handle.abort();
        }
        self.browser = None;
    }

    pub async fn refresh(&mut self, _sources: Vec<SourceConfig>) -> Result<(), String> {
        self.stop_all().await;
        Ok(())
    }
}
