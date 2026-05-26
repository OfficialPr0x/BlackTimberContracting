"use client";

import React, { useRef, useState, useEffect } from "react";
import { Paintbrush, Eraser, RotateCcw, Sparkles, Check } from "lucide-react";

type Template = "deck" | "fence" | "garage" | "pergola";

interface AiSketchResult {
  interpretation: string;
  detectedFeatures: string[];
  approximateDimensions: { length: number; width: number; notes?: string };
  matchReason: string;
  recommendedUpgrades: string[];
  bestPortfolioMatchUrl: string;
  // True when the server returned a deterministic portfolio match because
  // the AI was unavailable. UI uses this to soften the language.
  usedFallback?: boolean;
}

export default function DrawItOut() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color] = useState("#c5a880"); // Gold brush color
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [renderResult, setRenderResult] = useState<AiSketchResult | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>("deck");

  // Load template lines onto the canvas
  const drawTemplate = (templateType: Template) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setRenderedImage(null);
    setRenderResult(null);
    setRenderError(null);
    setSelectedTemplate(templateType);

    // Apply canvas settings
    ctx.strokeStyle = "#c5a880";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";

    ctx.beginPath();
    if (templateType === "deck") {
      // Draw a perspective deck frame
      ctx.moveTo(100, 250);
      ctx.lineTo(400, 200);
      ctx.lineTo(600, 300);
      ctx.lineTo(250, 370);
      ctx.closePath();
      // Draw posts
      ctx.moveTo(100, 250); ctx.lineTo(100, 320);
      ctx.moveTo(250, 370); ctx.lineTo(250, 440);
      ctx.moveTo(600, 300); ctx.lineTo(600, 370);
      // Draw steps
      ctx.moveTo(450, 280); ctx.lineTo(490, 330);
      ctx.moveTo(430, 290); ctx.lineTo(470, 340);
    } else if (templateType === "fence") {
      // Draw fence panels
      for (let i = 50; i < 650; i += 80) {
        ctx.rect(i, 150, 30, 200);
        ctx.moveTo(i + 15, 120);
        ctx.lineTo(i, 150);
        ctx.lineTo(i + 30, 150);
        ctx.closePath();
      }
      // Horizontal bars
      ctx.moveTo(30, 180); ctx.lineTo(650, 180);
      ctx.moveTo(30, 300); ctx.lineTo(650, 300);
    } else if (templateType === "garage") {
      // Draw a classic timber garage frame
      ctx.rect(150, 180, 400, 220); // main house body
      // Roof triangles
      ctx.moveTo(150, 180); ctx.lineTo(350, 80); ctx.lineTo(550, 180);
      // Garage door
      ctx.rect(200, 240, 140, 160);
      // Standard door
      ctx.rect(420, 260, 60, 140);
      // Window
      ctx.rect(420, 200, 60, 40);
    } else if (templateType === "pergola") {
      // Draw timber pergola structure
      // Posts
      ctx.rect(120, 140, 25, 260);
      ctx.rect(220, 160, 25, 240);
      ctx.rect(450, 160, 25, 240);
      ctx.rect(550, 140, 25, 260);
      // Main beam
      ctx.rect(80, 120, 540, 30);
      // Cross rafters
      for (let x = 140; x < 550; x += 50) {
        ctx.rect(x, 100, 15, 25);
      }
    }
    ctx.stroke();
  };

  useEffect(() => {
    // Initial draw
    drawTemplate("deck");
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    // Tool switching
    if (tool === "draw") {
      ctx.strokeStyle = color;
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.globalCompositeOperation = "destination-out";
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setRenderedImage(null);
    setRenderResult(null);
    setRenderError(null);
  };

  const handleAiRender = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRendering(true);
    setRenderError(null);
    setRenderResult(null);

    try {
      // Composite the sketch over a solid dark background — most models do
      // better on a clear background than on transparent PNGs.
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) throw new Error("Canvas export failed");
      exportCtx.fillStyle = "#0a0a0a";
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx.drawImage(canvas, 0, 0);
      const sketchDataUrl = exportCanvas.toDataURL("image/png");

      const res = await fetch("/api/ai/draw-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sketchDataUrl, template: selectedTemplate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message ?? `Render failed (${res.status})`);
      }
      const data = (await res.json()) as AiSketchResult;
      setRenderResult(data);
      setRenderedImage(data.bestPortfolioMatchUrl);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "AI sketch interpretation failed");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <section className="space-y-6" id="canvas-section">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Sketch Rendering
          </span>
          <h3 className="text-2xl font-bold uppercase tracking-tight text-white mt-1">
            Draw It Out Mode
          </h3>
          <p className="text-xs text-brand-gray">
            Bad at explaining your idea? Sketch a layout and let our AI translate it to a high-end structural photo render.
          </p>
        </div>

        {/* Templates Picker */}
        <div className="flex flex-wrap items-center gap-1.5 bg-brand-black p-1 border border-brand-border rounded-lg">
          {(
            [
              { id: "deck", label: "Deck" },
              { id: "fence", label: "Fence" },
              { id: "garage", label: "Garage/Shed" },
              { id: "pergola", label: "Pergola" },
            ] as const satisfies ReadonlyArray<{ id: Template; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => drawTemplate(t.id)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedTemplate === t.id && !renderedImage
                  ? "bg-brand-gold text-brand-black" 
                  : "text-brand-gray hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Drawing Controls Panel */}
        <div className="lg:col-span-1 bg-brand-panel p-5 rounded-2xl border border-brand-border flex flex-row lg:flex-col justify-between lg:justify-start gap-4">
          {/* Tool choices */}
          <div className="space-y-3 w-1/2 lg:w-full">
            <span className="text-[10px] font-bold text-brand-gray uppercase tracking-widest block">Drawing Tools</span>
            <div className="flex gap-2">
              <button
                onClick={() => setTool("draw")}
                className={`flex-1 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  tool === "draw"
                    ? "border-brand-gold bg-brand-gold/5 text-white"
                    : "border-brand-border text-brand-gray hover:text-white"
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                Draw
              </button>
              <button
                onClick={() => setTool("erase")}
                className={`flex-1 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  tool === "erase"
                    ? "border-brand-gold bg-brand-gold/5 text-white"
                    : "border-brand-border text-brand-gray hover:text-white"
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                Erase
              </button>
            </div>
          </div>

          {/* Size slider */}
          <div className="space-y-2 w-1/2 lg:w-full">
            <div className="flex justify-between items-center text-[10px] font-bold text-brand-gray uppercase tracking-widest">
              <span>Brush Thickness</span>
              <span className="text-brand-gold">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="2"
              max="15"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
            />

            {/* Clear and Reset */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={clearCanvas}
                className="flex-1 py-2 border border-brand-border hover:border-red-500/30 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
              <button
                onClick={() => drawTemplate(selectedTemplate)}
                className="flex-1 py-2 border border-brand-border hover:border-brand-gold/30 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all"
              >
                Reset Template
              </button>
            </div>
          </div>
        </div>

        {/* Drawing Canvas Area */}
        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-brand-border bg-brand-black shadow-2xl aspect-video w-full flex items-center justify-center">
          
          {/* THE CANVAS */}
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={`w-full h-full object-contain cursor-crosshair bg-brand-black ${
              renderedImage ? "hidden" : "block"
            }`}
          />

          {/* AI RENDER RESULT OVERLAY — matched portfolio photo + interpretation */}
          {renderedImage && (
            <div className="absolute inset-0 w-full h-full animate-fade-in">
              <img
                src={renderedImage}
                alt="Closest Black Timber Portfolio Match"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-4 sm:p-5 space-y-2">
                {renderResult && (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-gold flex items-center gap-1.5">
                      <Check className="w-3 h-3" /> Matched · {renderResult.detectedFeatures.length} features detected
                    </div>
                    <p className="text-xs text-white leading-relaxed line-clamp-3">{renderResult.matchReason}</p>
                  </>
                )}
              </div>
              <div
                className={`absolute top-4 right-4 px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded shadow flex items-center gap-1 ${
                  renderResult?.usedFallback
                    ? "bg-brand-charcoal text-brand-gold border border-brand-gold/40"
                    : "bg-brand-gold text-brand-black"
                }`}
              >
                <Check className="w-3 h-3" />
                {renderResult?.usedFallback ? "Portfolio Reference" : "AI Portfolio Match"}
              </div>
              <div className="absolute bottom-4 left-4 flex gap-2 hidden sm:hidden">
                {/* (moved below) */}
              </div>
              <div className="absolute top-4 left-4">
                <button
                  onClick={clearCanvas}
                  className="px-4 py-2 bg-black/80 hover:bg-black text-white text-[10px] font-bold tracking-widest uppercase rounded border border-brand-border shadow transition-all"
                >
                  Edit Sketch
                </button>
              </div>
            </div>
          )}

          {/* RENDERING LOADER OVERLAY */}
          {isRendering && (
            <div className="absolute inset-0 z-30 bg-black/95 flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in">
              <Sparkles className="w-8 h-8 text-brand-gold animate-spin" />
              <div className="text-center space-y-1">
                <div className="text-[11px] font-bold text-brand-gold uppercase tracking-widest">
                  Vision AI reading your sketch…
                </div>
                <div className="text-[10px] text-brand-gray font-mono">
                  Detecting features · sizing · matching to portfolio
                </div>
              </div>
            </div>
          )}

          {/* Canvas Instructions */}
          {!isRendering && !renderedImage && (
            <div className="absolute top-4 left-4 bg-brand-charcoal/80 border border-brand-border px-3 py-1 text-[9px] font-bold tracking-wider uppercase rounded text-brand-gray pointer-events-none select-none">
              Draw here using mouse or touch
            </div>
          )}
        </div>
      </div>

      {/* AI Interpretation panel — shown after a successful render */}
      {renderResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-slide-up">
          <div className="md:col-span-2 bg-brand-panel border border-brand-border rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
              What our AI saw in your sketch
            </span>
            <p className="text-xs text-brand-gray leading-relaxed">{renderResult.interpretation}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {renderResult.detectedFeatures.map((f, i) => (
                <span
                  key={i}
                  className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-brand-border text-brand-gray"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-brand-panel border border-brand-border rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
              Approx. size · upgrades to consider
            </span>
            <div className="text-xs text-white font-mono">
              {renderResult.approximateDimensions.length > 0 || renderResult.approximateDimensions.width > 0
                ? `${renderResult.approximateDimensions.length} × ${renderResult.approximateDimensions.width} ft`
                : "Scale not visible"}
            </div>
            <ul className="text-[11px] text-brand-gray space-y-1 pt-1">
              {renderResult.recommendedUpgrades.slice(0, 4).map((u, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-brand-gold mt-1.5 flex-shrink-0" />
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {renderError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
          {renderError}
        </div>
      )}

      {/* Render Trigger CTA */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleAiRender}
          disabled={isRendering || renderedImage !== null}
          className="w-full sm:w-auto px-8 py-4 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 disabled:cursor-not-allowed text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-brand-black" />
          {isRendering ? "Analyzing sketch…" : "Match my sketch with Black Timber AI"}
        </button>
      </div>
    </section>
  );
}
