use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};

mod ndi_streamer;
use ndi_streamer::StreamManager;

// State to hold our stream manager
pub struct AppState {
    pub stream_manager: Arc<Mutex<StreamManager>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SourceConfig {
    pub url: String,
    #[serde(rename = "ndiName")]
    pub ndi_name: String,
}

#[tauri::command]
async fn start_stream(
    sources: Vec<SourceConfig>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.stream_manager.lock().await;
    manager.start_all(sources, app).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn stop_stream(state: State<'_, AppState>) -> Result<(), String> {
    let mut manager = state.stream_manager.lock().await;
    manager.stop_all().await;
    Ok(())
}

#[tauri::command]
async fn refresh_sources(
    sources: Vec<SourceConfig>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.stream_manager.lock().await;
    // Just stop and start for a refresh, simplifies logic
    // Or send a navigation event if we build it out
    manager.refresh(sources).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            stream_manager: Arc::new(Mutex::new(StreamManager::new())),
        })
        .invoke_handler(tauri::generate_handler![
            start_stream,
            stop_stream,
            refresh_sources
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
