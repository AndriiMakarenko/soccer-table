pub mod commands;
pub mod database;
pub mod repository;

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            use tauri::Manager;
            app.manage(database::DatabaseState::default());
            Ok(())
        });

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        .invoke_handler(tauri::generate_handler![
            commands::initialize_database,
            commands::load_app_state,
            commands::persist_app_state,
            commands::delete_league,
            commands::delete_season,
            commands::regenerate_fixtures,
            commands::update_round_results,
            commands::reset_results,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
