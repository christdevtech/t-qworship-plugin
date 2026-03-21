import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

function App() {
  const [sources, setSources] = useState([
    { url: "", ndiName: "QWORSHIP_SRC1" },
    { url: "", ndiName: "QWORSHIP_SRC2" },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [layout, setLayout] = useState<"split" | "grid">("grid");
  const [stats, setStats] = useState({
    cpu: 0,
    ram: 0,
    sources: [
      { fps: 0, bitrateMbps: 0, active: false, previewData: "" },
      { fps: 0, bitrateMbps: 0, active: false, previewData: "" },
    ],
  });

  useEffect(() => {
    const unlisten = listen("stats-update", (event: any) => {
      setStats(prev => {
        const payload = event.payload;
        return {
          ...payload,
          sources: prev.sources.map((s, i) => payload.sources[i].active ? payload.sources[i] : s)
        };
      });
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    await getCurrentWindow().toggleMaximize();
  };

  const handleClose = async () => {
    await invoke("stop_stream");
    await getCurrentWindow().close();
  };

  const toggleStream = async () => {
    if (!isStreaming) {
      if (!sources[0].url && !sources[1].url) {
        alert("Please enter at least one URL before starting.");
        return;
      }
      setIsStreaming(true);
      await invoke("start_stream", { sources });
    } else {
      setIsStreaming(false);
      await invoke("stop_stream");
    }
  };

  const refreshSources = async () => {
    await invoke("refresh_sources", { sources });
  };

  const avgFps = (stats.sources[0].fps + stats.sources[1].fps) / 2 || 0;
  const bufMs = avgFps > 0 ? (1000 / avgFps).toFixed(1) : "—";
  
  const layoutClass = layout === "grid" 
    ? "grid grid-cols-2 gap-4 flex-1 items-start min-h-0"
    : "flex flex-col gap-4 flex-1 items-start min-h-0 overflow-y-auto";

  return (
    <>
      {/* TITLEBAR */}
      <header
        id="titlebar"
        data-tauri-drag-region
        className="h-12 border-b border-ndi-border flex items-center justify-between px-4 bg-ndi-dark shrink-0"
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <img
            src="/icon.png"
            className="w-6 h-6 rounded object-cover"
            alt="icon"
          />
          <h1 className="text-sm font-semibold tracking-wide uppercase text-gray-200">
            QWorship NDI Bridge
            <span className="text-ndi-accent ml-2 text-[10px] bg-ndi-accent/10 px-1.5 py-0.5 rounded border border-ndi-accent/20">
              DUAL-LINK
            </span>
          </h1>
        </div>

        {/* Window Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleMinimize}
            title="Minimize"
            className="hover:bg-ndi-border p-1.5 rounded transition-colors"
          >
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
          </button>
          <button
            onClick={handleMaximize}
            title="Maximize"
            className="hover:bg-ndi-border p-1.5 rounded transition-colors"
          >
            <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
              <rect height="18" rx="2" ry="2" width="18" x="3" y="3" />
            </svg>
          </button>
          <button
            onClick={handleClose}
            title="Close"
            className="hover:bg-ndi-danger p-1.5 rounded transition-colors"
          >
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="w-72 border-r border-ndi-border bg-ndi-card flex flex-col p-5 overflow-y-auto shrink-0">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Configuration</h2>

          <div className="space-y-8">
            {/* Source 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-ndi-accent rounded-full"></span>
                <h3 className="text-xs font-bold text-gray-300 uppercase">Source 1</h3>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={sources[0].url}
                  onChange={(e) => setSources(s => [{...s[0], url: e.target.value}, s[1]])}
                  className="bg-ndi-dark border border-ndi-border rounded-md px-3 py-1.5 text-xs focus:border-ndi-accent focus:ring-1 focus:ring-ndi-accent outline-none transition-all placeholder-gray-600 select-text"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">NDI Name</label>
                <input
                  type="text"
                  placeholder="e.g. MAIN_OVERLAY"
                  value={sources[0].ndiName}
                  onChange={(e) => setSources(s => [{...s[0], ndiName: e.target.value}, s[1]])}
                  className="bg-ndi-dark border border-ndi-border rounded-md px-3 py-1.5 text-xs focus:border-ndi-accent focus:ring-1 focus:ring-ndi-accent outline-none transition-all placeholder-gray-600 select-text"
                />
              </div>
            </div>

            <hr className="border-ndi-border" />

            {/* Source 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                <h3 className="text-xs font-bold text-gray-300 uppercase">Source 2</h3>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={sources[1].url}
                  onChange={(e) => setSources(s => [s[0], {...s[1], url: e.target.value}])}
                  className="bg-ndi-dark border border-ndi-border rounded-md px-3 py-1.5 text-xs focus:border-ndi-accent focus:ring-1 focus:ring-ndi-accent outline-none transition-all placeholder-gray-600 select-text"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">NDI Name</label>
                <input
                  type="text"
                  placeholder="e.g. CHAT_WIDGET"
                  value={sources[1].ndiName}
                  onChange={(e) => setSources(s => [s[0], {...s[1], ndiName: e.target.value}])}
                  className="bg-ndi-dark border border-ndi-border rounded-md px-3 py-1.5 text-xs focus:border-ndi-accent focus:ring-1 focus:ring-ndi-accent outline-none transition-all placeholder-gray-600 select-text"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={toggleStream}
                className={`w-full text-white text-xs font-bold py-3 rounded-md transition-all flex items-center justify-center gap-2 ${
                  isStreaming 
                    ? "bg-ndi-danger hover:bg-red-700" 
                    : "bg-ndi-accent hover:bg-ndi-accent-hover shadow-lg shadow-ndi-accent/20"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                {isStreaming ? "Stop All Streams" : "Start All Streams"}
              </button>
              <button
                onClick={refreshSources}
                className="w-full bg-transparent border border-ndi-border hover:bg-ndi-border text-gray-300 text-[10px] uppercase font-bold py-2 rounded-md transition-all"
              >
                Refresh All Sources
              </button>
            </div>
          </div>

          <div className="mt-auto pt-8">
            <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-ndi-border pt-4">
              <span>CPU: {stats.cpu}%</span>
              <span>RAM: {stats.ram}MB</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="flex-1 flex flex-col bg-ndi-dark p-5 overflow-hidden min-w-0">
          <div className="grid grid-cols-2 gap-3 mb-4 shrink-0">
            {/* Src 1 Status */}
            <div className="bg-ndi-card/40 p-3 rounded-lg border border-ndi-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">Src 1 Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full transition-colors ${isStreaming && sources[0].url ? "bg-ndi-success" : "bg-ndi-danger"}`}></span>
                    <span className={`text-xs font-semibold ${isStreaming && sources[0].url ? "text-ndi-success" : "text-gray-300"}`}>
                      {isStreaming && sources[0].url ? "Active" : "Offline"}
                    </span>
                  </div>
                </div>
                <div className="w-px h-6 bg-ndi-border"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">Res</span>
                  <span className="text-xs font-semibold text-gray-300">1920×1080</span>
                </div>
                <div className="w-px h-6 bg-ndi-border"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">FPS</span>
                  <span className="text-xs font-semibold text-gray-300">{stats.sources[0].active ? stats.sources[0].fps : "—"}</span>
                </div>
              </div>
              <div className="text-[9px] text-gray-500 font-mono">{stats.sources[0].active ? `${stats.sources[0].bitrateMbps} Mb/s` : "0.0 Mb/s"}</div>
            </div>

            {/* Src 2 Status */}
            <div className="bg-ndi-card/40 p-3 rounded-lg border border-ndi-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">Src 2 Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full transition-colors ${isStreaming && sources[1].url ? "bg-ndi-success" : "bg-ndi-danger"}`}></span>
                    <span className={`text-xs font-semibold ${isStreaming && sources[1].url ? "text-ndi-success" : "text-gray-300"}`}>
                      {isStreaming && sources[1].url ? "Active" : "Offline"}
                    </span>
                  </div>
                </div>
                <div className="w-px h-6 bg-ndi-border"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">Res</span>
                  <span className="text-xs font-semibold text-gray-300">1920×1080</span>
                </div>
                <div className="w-px h-6 bg-ndi-border"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">FPS</span>
                  <span className="text-xs font-semibold text-gray-300">{stats.sources[1].active ? stats.sources[1].fps : "—"}</span>
                </div>
              </div>
              <div className="text-[9px] text-gray-500 font-mono">{stats.sources[1].active ? `${stats.sources[1].bitrateMbps} Mb/s` : "0.0 Mb/s"}</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Multi-Source Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setLayout("split")}
                  className="text-[10px] bg-ndi-border px-2 py-0.5 rounded text-gray-300 hover:text-white transition-colors"
                >
                  Split Vertical
                </button>
                <button
                  onClick={() => setLayout("grid")}
                  className="text-[10px] bg-ndi-border px-2 py-0.5 rounded text-gray-300 hover:text-white transition-colors"
                >
                  Layout Grid
                </button>
              </div>
            </div>

            <div className={layoutClass}>
              {/* Preview 1 */}
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Output 1: {sources[0].ndiName || "—"}</span>
                  <div className="w-2 h-2 rounded-full bg-ndi-accent/50"></div>
                </div>
                <div className="relative w-full preview-aspect bg-black border border-ndi-border rounded-lg overflow-hidden">
                  {stats.sources[0].previewData ? (
                    <img src={stats.sources[0].previewData} className="absolute inset-0 w-full h-full object-cover" alt="" />
                  ) : (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${isStreaming && sources[0].url ? "hidden" : ""}`}>
                      <svg className="w-8 h-8 text-ndi-border" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" x2="22" y1="12" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
                      </svg>
                      <span className="text-[10px] text-gray-600">No source loaded</span>
                    </div>
                  )}
                  {isStreaming && sources[0].url && (
                    <div className="absolute bottom-3 left-3">
                      <span className="bg-ndi-danger text-[8px] font-bold px-1.5 py-0.5 rounded text-white flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>SRC1 LIVE
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview 2 */}
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Output 2: {sources[1].ndiName || "—"}</span>
                  <div className="w-2 h-2 rounded-full bg-blue-500/50"></div>
                </div>
                <div className="relative w-full preview-aspect bg-black border border-ndi-border rounded-lg overflow-hidden">
                  {stats.sources[1].previewData ? (
                    <img src={stats.sources[1].previewData} className="absolute inset-0 w-full h-full object-cover" alt="" />
                  ) : (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${isStreaming && sources[1].url ? "hidden" : ""}`}>
                      <svg className="w-8 h-8 text-ndi-border" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" x2="22" y1="12" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
                      </svg>
                      <span className="text-[10px] text-gray-600">No source loaded</span>
                    </div>
                  )}
                  {isStreaming && sources[1].url && (
                    <div className="absolute bottom-3 left-3">
                      <span className="bg-ndi-danger text-[8px] font-bold px-1.5 py-0.5 rounded text-white flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>SRC2 LIVE
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="h-9 bg-ndi-dark border-t border-ndi-border flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-5 text-[10px] text-gray-500 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ndi-success"></span>
            <span>{isStreaming ? "NDI Dual-Core Active" : "NDI Dual-Core Ready"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg fill="none" height="11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="11">
              <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure Bridge
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-1 h-3 bg-ndi-accent rounded-full transition-opacity" style={{ opacity: isStreaming && sources[0].url ? 1 : 0.25 }}></div>
              <span className="text-[6px]">1</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-1 h-3 bg-blue-500 rounded-full transition-opacity" style={{ opacity: isStreaming && sources[1].url ? 1 : 0.25 }}></div>
              <span className="text-[6px]">2</span>
            </div>
          </div>
          <span className="text-[10px] text-gray-500">Global Buffers: <span>{bufMs !== "—" ? `${bufMs}ms` : "—"}</span></span>
        </div>
      </footer>
    </>
  );
}

export default App;
