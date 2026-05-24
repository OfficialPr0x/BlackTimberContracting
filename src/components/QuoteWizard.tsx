"use client";

import React, { useState, useEffect } from "react";
import { Upload, Calculator, Clock, Calendar, CheckCircle, ChevronRight, X, AlertTriangle, Play, Sparkles } from "lucide-react";

interface QuoteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
}

const STEPS = [
  { id: 1, title: "Project Specs" },
  { id: 2, title: "Media Upload" },
  { id: 3, title: "AI Analysis" },
  { id: 4, title: "Your Quote" },
  { id: 5, title: "Book Site Visit" }
];

export default function QuoteWizard({ isOpen, onClose, initialType = "deck" }: QuoteWizardProps) {
  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState(initialType);
  const [dimensions, setDimensions] = useState({ length: 16, width: 12 });
  const [material, setMaterial] = useState("cedar");
  const [upgrades, setUpgrades] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [sketchPreview, setSketchPreview] = useState<string | null>(null);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [aiProgress, setAiProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [contactInfo, setContactInfo] = useState({ name: "", email: "", phone: "" });
  const [isBooked, setIsBooked] = useState(false);

  // AI Analysis simulation logs
  const logsList = [
    "Initializing Black Timber AI engine...",
    "Analyzing uploaded site photography & drawing contours...",
    "Scanning regional district permit bylaws & zoning charts...",
    "Determining slope variance & frost line depth for Kootenays...",
    "Calculating structural lumber requirements (joists, beams, framing)...",
    "Running snow load calculations (Region code: BC-Kootenay)...",
    "Estimating hardware counts: ledger boards, joist hangers, structural screws...",
    "Generating material cost estimate with local supplier databases...",
    "Calculating crew hours & timeline parameters...",
    "Quote package successfully finalized."
  ];

  useEffect(() => {
    if (step === 3) {
      setAiProgress(0);
      setAiLogs([]);
      setAnalysisComplete(false);
      let currentLogIndex = 0;
      
      const logInterval = setInterval(() => {
        if (currentLogIndex < logsList.length) {
          setAiLogs(prev => [...prev, logsList[currentLogIndex]]);
          currentLogIndex++;
        }
      }, 500);

      const progressInterval = setInterval(() => {
        setAiProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            clearInterval(logInterval);
            setAnalysisComplete(true);
            setTimeout(() => {
              setStep(4);
            }, 800);
            return 100;
          }
          return prev + 5;
        });
      }, 250);

      return () => {
        clearInterval(logInterval);
        clearInterval(progressInterval);
      };
    }
  }, [step]);

  if (!isOpen) return null;

  const toggleUpgrade = (id: string) => {
    setUpgrades(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      setFiles(prev => [...prev, ...fileList]);
      
      const file = e.target.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSketchPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Live Price Calculation inside Modal
  const calculatePrice = () => {
    const area = dimensions.length * dimensions.width;
    let basePricePerSqFt = 45; // pressure treated
    if (material === "cedar") basePricePerSqFt = 65;
    if (material === "composite") basePricePerSqFt = 85;

    let subtotal = area * basePricePerSqFt;

    // Upgrades
    if (upgrades.includes("stairs")) subtotal += 1800;
    if (upgrades.includes("lighting")) subtotal += 1200;
    if (upgrades.includes("railing")) subtotal += 2500;
    if (upgrades.includes("pergola")) subtotal += 5500;
    if (upgrades.includes("roof")) subtotal += 8000;

    // Add mock slope difficulty factor if address includes certain terms, let's keep standard
    const min = Math.round(subtotal * 0.9);
    const max = Math.round(subtotal * 1.15);

    return {
      min: min.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
      max: max.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
      area,
      materials: [
        `${material === 'cedar' ? 'Premium Western Red Cedar' : material === 'composite' ? 'TimberTech/Trex Composite' : 'Pressure-Treated Structural Wood'} Planks`,
        "Simpson Strong-Tie structural framing screws & connectors",
        "Helical pile anchors or engineered concrete footings",
        "Weather-resistant flashing & moisture barrier protection",
        ...upgrades.map(u => {
          if (u === "stairs") return "Custom stringer stairs with landing steps";
          if (u === "lighting") return "Integrated low-voltage LED step & post-cap lighting";
          if (u === "railing") return "Premium black aluminum handrails";
          if (u === "pergola") return "Custom structural timber pergola frame";
          return "Engineered heavy snow load solid patio roof";
        })
      ]
    };
  };

  const quote = calculatePrice();

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooked(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-brand-border bg-brand-charcoal text-left shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-brand-border bg-brand-black">
          <div className="flex items-center space-x-3">
            <img
              src="https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png"
              alt="Black Timber Contracting"
              className="h-10 w-auto"
              draggable={false}
            />
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight uppercase text-foreground">
                Instant AI Estimate Builder
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-brand-gray hover:text-white hover:bg-brand-border transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="px-6 py-4 bg-brand-black/40 border-b border-brand-border hidden md:flex justify-between items-center text-xs">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold mr-2 border transition-all ${
                step === s.id 
                  ? "bg-brand-gold text-brand-black border-brand-gold font-bold scale-110 shadow-sm"
                  : step > s.id 
                  ? "bg-brand-gold/20 text-brand-gold border-brand-gold/30"
                  : "bg-transparent text-brand-gray border-brand-border"
              }`}>
                {step > s.id ? "✓" : s.id}
              </span>
              <span className={`font-semibold tracking-wider uppercase ${step === s.id ? "text-brand-gold" : "text-brand-gray"}`}>
                {s.title}
              </span>
              {idx < STEPS.length - 1 && (
                <div className={`h-[1px] w-8 mx-4 ${step > s.id ? "bg-brand-gold/30" : "bg-brand-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* STEP 1: Specs */}
          {step === 1 && (
            <div className="space-y-6 animate-slide-up">
              <div>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Project Details</h3>
                <p className="text-sm text-brand-gray">Select what you want to build and choose the dimensions.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "deck", label: "Deck", desc: "Custom outdoor living" },
                  { id: "pergola", label: "Pergola", desc: "Timber & shading" },
                  { id: "garage", label: "Garage", desc: "Parking & framing" },
                  { id: "addition", label: "Addition", desc: "Home expansion" }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProjectType(p.id)}
                    className={`p-4 rounded-xl text-left border transition-all glass-panel ${
                      projectType === p.id 
                        ? "border-brand-gold bg-brand-gold/5 text-foreground" 
                        : "border-brand-border hover:border-brand-gold/30 text-brand-gray hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold text-white uppercase tracking-wider">{p.label}</div>
                    <div className="text-[11px] mt-1 text-brand-gray">{p.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sliders */}
                <div className="space-y-4 bg-brand-black/30 p-5 rounded-xl border border-brand-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-wider text-brand-gray">Length (ft)</span>
                    <span className="text-lg font-bold text-brand-gold">{dimensions.length} ft</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={dimensions.length}
                    onChange={(e) => setDimensions(prev => ({ ...prev, length: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
                  />

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-brand-gray">Width (ft)</span>
                    <span className="text-lg font-bold text-brand-gold">{dimensions.width} ft</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={dimensions.width}
                    onChange={(e) => setDimensions(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
                  />
                  <div className="text-[11px] text-right text-brand-gray pt-1">
                    Total Estimated Area: <span className="text-white font-bold">{dimensions.length * dimensions.width} sq ft</span>
                  </div>
                </div>

                {/* Materials Selection */}
                <div className="space-y-4 bg-brand-black/30 p-5 rounded-xl border border-brand-border">
                  <div className="text-sm font-bold uppercase tracking-wider text-brand-gray mb-2">Wood / Material</div>
                  {[
                    { id: "treated", label: "Pressure Treated Wood", price: "Budget-Friendly ($)" },
                    { id: "cedar", label: "Western Red Cedar", price: "Premium Natural ($$)" },
                    { id: "composite", label: "Composite (Trex / TimberTech)", price: "Zero Maintenance ($$$)" }
                  ].map(m => (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        material === m.id 
                          ? "border-brand-gold bg-brand-gold/5" 
                          : "border-brand-border hover:bg-brand-charcoal"
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="material"
                          checked={material === m.id}
                          onChange={() => setMaterial(m.id)}
                          className="mr-3 text-brand-gold accent-brand-gold focus:ring-0"
                        />
                        <span className="text-sm font-bold text-white uppercase">{m.label}</span>
                      </div>
                      <span className="text-[10px] text-brand-gold uppercase tracking-wider font-semibold">{m.price}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Addons */}
              <div className="space-y-3">
                <span className="text-sm font-bold uppercase tracking-wider text-brand-gray">Select Add-ons & Features</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: "stairs", label: "Add Stairs" },
                    { id: "lighting", label: "Post & Step Lighting" },
                    { id: "railing", label: "Black Metal Railing" },
                    { id: "pergola", label: "Timber Pergola Structure" },
                    { id: "roof", label: "Covered Solid Patio Roof" }
                  ].map(u => (
                    <button
                      key={u.id}
                      onClick={() => toggleUpgrade(u.id)}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        upgrades.includes(u.id) 
                          ? "border-brand-gold bg-brand-gold/5 text-white" 
                          : "border-brand-border text-brand-gray hover:text-white hover:border-brand-gold/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold uppercase tracking-wider">{u.label}</span>
                        {upgrades.includes(u.id) && <span className="text-brand-gold">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Uploads */}
          {step === 2 && (
            <div className="space-y-6 animate-slide-up">
              <div>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Upload Backyard Photos or Sketch</h3>
                <p className="text-sm text-brand-gray">Our AI vision model uses these photos to check structural attachments, elevations, and generate visual renders.</p>
              </div>

              <div className="border-2 border-dashed border-brand-border hover:border-brand-gold/40 rounded-xl p-8 text-center bg-brand-black/20 cursor-pointer transition-all relative">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-12 h-12 text-brand-gold mx-auto mb-3 animate-bounce" />
                <p className="text-sm font-bold text-white uppercase tracking-wider">Drag & drop files here, or click to browse</p>
                <p className="text-xs text-brand-gray mt-1">Upload backyard photos, measurements, a rough sketch, or a voice note (PNG, JPG, PDF, MP3)</p>
              </div>

              {/* Render Uploaded Previews */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-gray">Uploaded Files ({files.length})</span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {files.map((f, i) => (
                      <div key={i} className="relative aspect-video rounded-lg border border-brand-border overflow-hidden bg-brand-black flex items-center justify-center p-2 text-center text-[10px]">
                        {sketchPreview && i === 0 ? (
                          <img src={sketchPreview} alt="Preview" className="object-cover w-full h-full" />
                        ) : (
                          <div className="text-brand-gray truncate max-w-full font-mono">{f.name}</div>
                        )}
                        <button
                          onClick={() => {
                            setFiles(prev => prev.filter((_, idx) => idx !== i));
                            if (i === 0) setSketchPreview(null);
                          }}
                          className="absolute top-1 right-1 bg-black/80 rounded-full p-0.5 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sketch Options or Voice Note */}
              <div className="bg-brand-panel p-4 rounded-lg border border-brand-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Bad at explaining in text?</div>
                  <div className="text-xs text-brand-gray">You can sketch your project directly in our Drawing Widget on the home screen.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    // Smooth scroll to canvas
                    const canvasSec = document.getElementById("canvas-section");
                    if (canvasSec) {
                      canvasSec.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="px-4 py-2 border border-brand-gold text-[10px] font-bold text-brand-gold rounded hover:bg-brand-gold hover:text-brand-black transition-all uppercase tracking-widest"
                >
                  Go Sketch Instead
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: AI Analysis */}
          {step === 3 && (
            <div className="space-y-8 py-8 animate-slide-up flex flex-col items-center justify-center">
              <div className="relative w-28 h-28">
                {/* Rotating progress border */}
                <div className="absolute inset-0 rounded-full border-4 border-brand-border" />
                <div 
                  className="absolute inset-0 rounded-full border-4 border-brand-gold border-t-transparent animate-spin" 
                  style={{ animationDuration: "1.5s" }}
                />
                <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-brand-gold font-mono">
                  {aiProgress}%
                </div>
              </div>

              <div className="text-center space-y-2 max-w-md">
                <h4 className="font-bold text-white uppercase tracking-wider text-base">Black Timber AI Vision Pipeline</h4>
                <p className="text-xs text-brand-gray">Analyzing photo materials, local slope coordinates, and framing specifications to calculate your pricing matrix.</p>
              </div>

              {/* Logging screen */}
              <div className="w-full bg-black rounded-lg border border-brand-border p-4 font-mono text-[11px] text-green-400 space-y-1 h-44 overflow-y-auto scrollbar-thin">
                {aiLogs.map((log, i) => (
                  <div key={i} className="flex items-start">
                    <span className="text-brand-gold mr-2">{">"}</span>
                    <span>{log}</span>
                  </div>
                ))}
                {aiProgress < 100 && (
                  <div className="animate-pulse flex items-center">
                    <span className="text-brand-gold mr-2">{">"}</span>
                    <span className="w-2 h-4 bg-green-400 inline-block" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Estimate Output */}
          {step === 4 && (
            <div className="space-y-6 animate-slide-up">
              <div className="flex justify-between items-start border-b border-brand-border pb-4">
                <div>
                  <div className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                    High-Confidence AI Estimate
                  </div>
                  <h3 className="text-xl font-bold uppercase text-white mt-1">Rough Pricing Summary</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-brand-gray uppercase block">Project Area</span>
                  <span className="font-mono font-bold text-white">{quote.area} sq ft</span>
                </div>
              </div>

              {/* Price brackets banner */}
              <div className="bg-brand-black/50 border border-brand-gold/20 p-6 rounded-xl text-center space-y-2">
                <span className="text-xs uppercase tracking-widest text-brand-gray font-bold">Estimated Cost Bracket</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-gold font-mono tracking-tight">
                  {quote.min} – {quote.max}
                </h2>
                <p className="text-[11px] text-brand-gray max-w-md mx-auto">
                  *Range reflects regional Kootenay shipping, helical pile structural anchors, and seasonal building parameters. Final custom quote may vary.
                </p>
              </div>

              {/* Material checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-gray">AI Structural Breakdown</span>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {quote.materials.map((mat, i) => (
                      <div key={i} className="flex items-center text-xs text-brand-gray">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mr-2 flex-shrink-0" />
                        <span className="truncate">{mat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 bg-brand-panel p-4 rounded-lg border border-brand-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-brand-gold" />
                    Kootenay Signal Assessment
                  </span>
                  <div className="text-xs space-y-2 text-brand-gray leading-relaxed">
                    <p>
                      <strong>Permits:</strong> Located in East Kootenay District. Structural design requires municipal review for snow loads.
                    </p>
                    <p>
                      <strong>Frost Line:</strong> Standard footing depth of 48 inches recommended to secure deck anchors.
                    </p>
                    <p className="text-[10px] text-brand-gold">
                      💡 Click &quot;Book Consultation&quot; to lock in these materials and lock down a priority site visit schedule.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Cal.com scheduling */}
          {step === 5 && (
            <div className="space-y-6 animate-slide-up">
              {!isBooked ? (
                <form onSubmit={handleBooking} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Schedule Your Site Visit</h3>
                    <p className="text-sm text-brand-gray">Pick a time for a site layout consult. Real builder. Not a sales rep.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Calendar grid mock */}
                    <div className="bg-brand-black/30 p-4 rounded-xl border border-brand-border">
                      <div className="text-xs font-bold uppercase text-brand-gray tracking-wider mb-3">Available Dates (May/June 2026)</div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { date: "May 26", text: "Tue" },
                          { date: "May 27", text: "Wed" },
                          { date: "May 28", text: "Thu" },
                          { date: "May 29", text: "Fri" },
                          { date: "Jun 01", text: "Mon" },
                          { date: "Jun 02", text: "Tue" },
                          { date: "Jun 03", text: "Wed" },
                          { date: "Jun 04", text: "Thu" }
                        ].map(d => (
                          <button
                            key={d.date}
                            type="button"
                            onClick={() => setBookingDate(d.date)}
                            className={`p-2.5 rounded-lg border text-center text-xs transition-all ${
                              bookingDate === d.date 
                                ? "bg-brand-gold text-brand-black border-brand-gold font-bold" 
                                : "border-brand-border text-brand-gray hover:border-brand-gold/30 hover:text-white"
                            }`}
                          >
                            <span className="block font-bold">{d.date}</span>
                            <span className="text-[9px] uppercase tracking-widest block opacity-70 mt-0.5">{d.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Time slots */}
                    <div className="bg-brand-black/30 p-4 rounded-xl border border-brand-border flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase text-brand-gray tracking-wider mb-3">Time Slots</div>
                        {bookingDate ? (
                          <div className="grid grid-cols-2 gap-2">
                            {["08:00 AM", "10:30 AM", "01:00 PM", "03:30 PM"].map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setBookingTime(t)}
                                className={`p-2 rounded border text-[11px] transition-all font-mono ${
                                  bookingTime === t 
                                    ? "bg-brand-gold text-brand-black border-brand-gold font-semibold" 
                                    : "border-brand-border text-brand-gray hover:border-brand-gold/20"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-brand-gray italic text-center py-6">Select a date first to reveal times.</div>
                        )}
                      </div>

                      {bookingDate && bookingTime && (
                        <div className="text-center text-xs text-brand-gold mt-4 font-mono">
                          Selected: {bookingDate} @ {bookingTime}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-4 bg-brand-panel p-5 rounded-xl border border-brand-border">
                    <div className="text-xs font-bold uppercase text-white tracking-wider">Contact & Site Address</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="Your Name"
                        required
                        value={contactInfo.name}
                        onChange={(e) => setContactInfo(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded p-2.5 text-xs text-white placeholder:text-brand-gray"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        required
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded p-2.5 text-xs text-white placeholder:text-brand-gray"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        required
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo(prev => ({ ...prev, phone: e.target.value }))}
                        className="bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded p-2.5 text-xs text-white placeholder:text-brand-gray"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!bookingDate || !bookingTime}
                    className="w-full py-4 bg-brand-gold disabled:bg-brand-border disabled:text-brand-gray disabled:cursor-not-allowed hover:bg-brand-gold-hover text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
                  >
                    Confirm Booking Consultation
                  </button>
                </form>
              ) : (
                <div className="text-center py-10 space-y-6 animate-slide-up">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold uppercase text-white">Consultation Confirmed!</h3>
                    <p className="text-sm text-brand-gray max-w-md mx-auto">
                      Thank you, {contactInfo.name}. We have scheduled your site consultation for <strong className="text-brand-gold">{bookingDate} at {bookingTime}</strong>.
                    </p>
                  </div>

                  <div className="bg-brand-panel max-w-sm mx-auto p-4 rounded-lg border border-brand-border space-y-2 text-xs text-brand-gray font-mono">
                    <div className="flex justify-between">
                      <span>SMS Confirmation:</span>
                      <span className="text-green-400">Sent to {contactInfo.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email Report PDF:</span>
                      <span className="text-green-400">Sent to {contactInfo.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned Builder:</span>
                      <span className="text-white">Jaryd (Black Timber)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 bg-brand-border text-white text-xs font-bold rounded-lg hover:bg-brand-border/80 uppercase tracking-widest transition-all"
                  >
                    Close Window
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-brand-border bg-brand-black flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1 || step === 3 || isBooked}
            className="px-4 py-2 border border-brand-border hover:border-brand-gold/30 hover:text-white rounded-lg text-xs font-bold uppercase tracking-widest text-brand-gray disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Back
          </button>
          
          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep(prev => prev + 1)}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black rounded-lg text-xs font-bold uppercase tracking-widest shadow transition-all flex items-center"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={() => setStep(5)}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black rounded-lg text-xs font-bold uppercase tracking-widest shadow transition-all flex items-center"
            >
              Book Site Consultation
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
