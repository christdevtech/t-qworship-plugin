use crate::SourceConfig;
use headless_chrome::{Browser, LaunchOptions};
use ndi::{Send as NdiSend, SendBuilder, VideoData, FourCCVideoType, FrameFormatType};
use tauri::AppHandle;
use tokio::task::JoinHandle;
use std::time::Duration;
use tauri::Emitter;
use serde::Serialize;

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
            .build()
            .map_err(|e| e.to_string())?;

        let browser = Browser::new(options).map_err(|e| e.to_string())?;
        
        // We will collect stats using channels or shared state, but for simplicity
        // in this bridge we can just emit an empty or stubbed stats payload loop.
        // Or we can let the tasks emit events directly.
        
        for (i, source) in sources.into_iter().enumerate() {
            if source.url.is_empty() {
                continue;
            }
            
            let tab = browser.new_tab().map_err(|e| e.to_string())?;
            tab.navigate_to(&source.url).map_err(|e| e.to_string())?;
            tab.wait_until_navigated().map_err(|e| e.to_string())?;
            
            // Set 30fps screencast approximation by looping capture
            let ndi_name = source.ndi_name.clone();
            let app_clone = app.clone();
            
            let handle = tokio::task::spawn_blocking(move || {
                let sender = SendBuilder::new().ndi_name(ndi_name).build();
                let sender: NdiSend = match sender {
                    Ok(s) => s,
                    Err(_) => return, // Failed to create NDI sender
                };

                let mut frame_count = 0;
                let mut last_fps_check = std::time::Instant::now();
                let mut current_fps = 0;

                loop {
                    let start = std::time::Instant::now();
                    
                    if let Ok(png_data) = tab.capture_screenshot(
                        headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
                        None,
                        None,
                        true // from surface (true) for transparency
                    ) {
                        if let Ok(img) = image::load_from_memory(&png_data) {
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
                                &mut rgba
                            );
                            
                            sender.send_video(&video_data);
                            frame_count += 1;
                        }
                    }

                    if last_fps_check.elapsed().as_secs() >= 1 {
                        current_fps = frame_count;
                        frame_count = 0;
                        last_fps_check = std::time::Instant::now();
                        
                        // Emit stats to frontend (stubbed for one source, actual would aggregate)
                        // This is heavily simplified for the boilerplate.
                        let _ = app_clone.emit("stats-update", StatsUpdate {
                            cpu: 0,
                            ram: 0,
                            sources: vec![
                                SourceStats {
                                    fps: current_fps,
                                    bitrate_mbps: 0.0,
                                    active: true,
                                    preview_data: String::new(), // Could pass base64 PNG here
                                },
                                SourceStats {
                                    fps: 0,
                                    bitrate_mbps: 0.0,
                                    active: false,
                                    preview_data: String::new(),
                                }
                            ]
                        });
                    }

                    let elapsed = start.elapsed();
                    let target = Duration::from_millis(33); // ~30 fps target
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
        self.browser = None; // Drop browser closes all tabs
    }

    pub async fn refresh(&mut self, _sources: Vec<SourceConfig>) -> Result<(), String> {
        // Simple refresh is to restart
        // Real implementation would just re-navigate existing tabs
        self.stop_all().await;
        // The frontend manages state so start_all must be called again
        Ok(())
    }
}
