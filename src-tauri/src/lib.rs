use tauri_plugin_dialog::DialogExt;

/// Open a PDF via native file dialog. Returns { bytes, name } or null if cancelled.
#[tauri::command]
fn open_pdf(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("PDF Files", &["pdf"])
        .blocking_pick_file();

    match result {
        Some(file_path) => {
            let path = file_path
                .into_path()
                .map_err(|_| "Unsupported path type".to_string())?;
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("document.pdf")
                .to_string();
            let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
            Ok(Some(serde_json::json!({ "bytes": bytes, "name": name })))
        }
        None => Ok(None),
    }
}

/// Save a PDF via native save dialog. Returns the saved path or null if cancelled.
#[tauri::command]
fn save_pdf(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    default_name: String,
) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("PDF Files", &["pdf"])
        .blocking_save_file();

    match result {
        Some(file_path) => {
            let path = file_path
                .into_path()
                .map_err(|_| "Unsupported path type".to_string())?;
            std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_pdf, save_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
