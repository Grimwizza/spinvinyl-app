import React, { useState, useRef, useCallback, useMemo } from "react";

// ─── Result Cache (4-hour TTL, keyed by product+retailer) ─────────────────
const PRICE_CACHE_KEY = "priceTracker_cache_v1";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
function getCache() { try { return JSON.parse(sessionStorage.getItem(PRICE_CACHE_KEY) || "{}"); } catch { return {}; } }
function setCache(c) { try { sessionStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(c)); } catch { } }
function cacheKey(job) { return `${(job.upc || job.model || job.sku || job.name || "").toLowerCase().trim()}||${(job.retailer || "").toLowerCase()}`; }
function readCache(job) { const c = getCache(); const e = c[cacheKey(job)]; if (e && Date.now() < e.exp) return e.data; return null; }
function writeCache(job, data) { const c = getCache(); c[cacheKey(job)] = { data, exp: Date.now() + CACHE_TTL_MS }; setCache(c); }
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { SEO } from "../../seo-tools/SEOTags";
import { Icon } from "../ui/Icon";



// ─── Retailer Registry ────────────────────────────────────────────────────
const RETAILER_CATEGORIES = [
    {
        name: "E-Commerce", emoji: "🛒",
        retailers: [
            { name: "Amazon", domain: "amazon.com", searchUrl: (q) => `https://www.amazon.com/s?k=${q}`, color: { bg: "#FF9900", text: "#000" } },
            { name: "eBay", domain: "ebay.com", searchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}`, color: { bg: "#E53238", text: "#fff" } },
            { name: "Overstock", domain: "overstock.com", searchUrl: (q) => `https://www.overstock.com/search?keywords=${q}`, color: { bg: "#003366", text: "#fff" } },
        ],
    },
    {
        name: "Mass", emoji: "🏬",
        retailers: [
            { name: "Walmart", domain: "walmart.com", searchUrl: (q) => `https://www.walmart.com/search?q=${q}`, color: { bg: "#0071CE", text: "#fff" } },
            { name: "Target", domain: "target.com", searchUrl: (q) => `https://www.target.com/s?searchTerm=${q}`, color: { bg: "#CC0000", text: "#fff" } },
        ],
    },
    {
        name: "Club", emoji: "👥",
        retailers: [
            { name: "Costco", domain: "costco.com", searchUrl: (q) => `https://www.costco.com/s?keyword=${q}`, color: { bg: "#005DAA", text: "#fff" } },
            { name: "Sam's Club", domain: "samsclub.com", searchUrl: (q) => `https://www.samsclub.com/s/${q}`, color: { bg: "#007DC6", text: "#fff" } },
            { name: "BJ's Wholesale", domain: "bjs.com", searchUrl: (q) => `https://www.bjs.com/search/results.jsp?q=${q}`, color: { bg: "#CF1020", text: "#fff" } },
        ],
    },
    {
        name: "Electronics", emoji: "💻",
        retailers: [
            { name: "Best Buy", domain: "bestbuy.com", searchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`, color: { bg: "#003399", text: "#fff" } },
            { name: "B&H Photo", domain: "bhphotovideo.com", searchUrl: (q) => `https://www.bhphotovideo.com/c/search?q=${q}`, color: { bg: "#1c2434", text: "#fff" } },
            { name: "Adorama", domain: "adorama.com", searchUrl: (q) => `https://www.adorama.com/l/?searchinfo=${q}`, color: { bg: "#E31837", text: "#fff" } },
            { name: "Newegg", domain: "newegg.com", searchUrl: (q) => `https://www.newegg.com/p/pl?d=${q}`, color: { bg: "#E77B00", text: "#fff" } },
        ],
    },
    {
        name: "Home Improvement", emoji: "🔨",
        retailers: [
            { name: "Home Depot", domain: "homedepot.com", searchUrl: (q) => `https://www.homedepot.com/s/${q}`, color: { bg: "#F96302", text: "#fff" } },
            { name: "Lowe's", domain: "lowes.com", searchUrl: (q) => `https://www.lowes.com/search?searchTerm=${q}`, color: { bg: "#004990", text: "#fff" } },
            { name: "Menards", domain: "menards.com", searchUrl: (q) => `https://www.menards.com/main/search.html?search=${q}`, color: { bg: "#005500", text: "#fff" } },
            { name: "Ace Hardware", domain: "acehardware.com", searchUrl: (q) => `https://www.acehardware.com/departments?searchTerm=${q}`, color: { bg: "#C8102E", text: "#fff" } },
        ],
    },
    {
        name: "Food & Drug", emoji: "💊",
        retailers: [
            { name: "Walgreens", domain: "walgreens.com", searchUrl: (q) => `https://www.walgreens.com/search/results.jsp?Ntt=${q}`, color: { bg: "#E31837", text: "#fff" } },
            { name: "CVS", domain: "cvs.com", searchUrl: (q) => `https://www.cvs.com/search/${q}`, color: { bg: "#CC0000", text: "#fff" } },
        ],
    },
];

// Derived helpers — single source of truth
const ALL_RETAILERS = RETAILER_CATEGORIES.flatMap((c) => c.retailers);
const RETAILER_MAP = Object.fromEntries(ALL_RETAILERS.map((r) => [r.name, r]));

const STORAGE_KEY = "priceTracker_v1";

function getStreakKey(r) {
    return [r.retailer || "", r.productName || r.name || "", r.sku || r.model || ""]
        .map((s) => s.toLowerCase().trim()).join("||");
}

function usePriceTrackerStorage() {
    const [st, setSt] = useState(() => {
        try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : { scans: [], streaks: {}, savedProducts: [] }; }
        catch { return { scans: [], streaks: {}, savedProducts: [] }; }
    });
    const persist = (ns) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ns)); } catch { } setSt(ns); };

    const saveScan = (results) => {
        const today = new Date().toISOString().slice(0, 10);
        const isRescan = st.scans.some((s) => s.id === today);
        const newStreaks = { ...st.streaks };
        results.filter((r) => r.status === "done").forEach((r) => {
            const key = getStreakKey(r); const tier = getMAPTier(r.discountPercent); const cur = newStreaks[key] || { consecutiveDays: 0 };
            if (tier === "violation") {
                if (isRescan && cur.lastScanDate === today) { newStreaks[key] = cur; }
                else { newStreaks[key] = { consecutiveDays: (cur.consecutiveDays || 0) + 1, firstViolationDate: cur.firstViolationDate || today, lastScanDate: today }; }
            } else { newStreaks[key] = { consecutiveDays: 0, lastScanDate: today }; }
        });
        const done = results.filter((r) => r.status === "done");
        const viol = done.filter((r) => getMAPTier(r.discountPercent) === "violation").length;
        const comp = done.filter((r) => getMAPTier(r.discountPercent) === "compliant").length;
        const withP = done.filter((r) => r.discountPercent != null);
        const cr = withP.length > 0 ? ((comp / withP.length) * 100).toFixed(1) : null;
        const scanRec = {
            id: today,
            dateLabel: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            results: done,
            stats: { total: done.length, violations: viol, complianceRate: cr },
        };
        const newScans = isRescan
            ? st.scans.map((s) => (s.id === today ? scanRec : s))
            : [...st.scans, scanRec].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 90);
        persist({ ...st, scans: newScans, streaks: newStreaks });
    };

    const deleteScan = (id) => persist({ ...st, scans: st.scans.filter((s) => s.id !== id) });
    const saveProducts = (p) => persist({ ...st, savedProducts: p });
    const saveList = (list) => {
        const existing = st.savedLists || [];
        const idx = existing.findIndex(l => l.id === list.id);
        const newLists = idx >= 0 ? existing.map((l, i) => i === idx ? list : l) : [...existing, list];
        persist({ ...st, savedLists: newLists });
    };
    const deleteList = (id) => persist({ ...st, savedLists: (st.savedLists || []).filter(l => l.id !== id) });
    const clearHistory = () => persist({ ...st, scans: [] });
    return { storage: st, saveScan, deleteScan, saveProducts, saveList, deleteList, clearHistory };
}

// ─── MAP / MSRP Tier Logic ─────────────────────────────────────────────────
// discountPercent = how far below MSRP the current price is (positive = below MAP)
// threshold: configurable % below which is still compliant (default 5)
function getMAPTier(discountPercent, threshold = 5) {
    if (discountPercent == null) return null;
    if (discountPercent < threshold) return "compliant";
    return "violation";
}

// ─── Settings ─────────────────────────────────────────────────────────────
const SETTINGS_KEY = "priceTracker_settings_v1";
const DEFAULT_SETTINGS = { violationThreshold: 5, warn1Day: 1, warn2Day: 2, warn3Day: 3, escalateDay: 4 };

function useSettings() {
    const [settings, setSettings] = useState(() => {
        try { const s = localStorage.getItem(SETTINGS_KEY); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS; }
        catch { return DEFAULT_SETTINGS; }
    });
    const updateSettings = (updates) => {
        const ns = { ...settings, ...updates };
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(ns)); } catch { }
        setSettings(ns);
    };
    return { settings, updateSettings };
}

const TIER = {
    compliant: { label: "✅ Compliant", color: "#15803d", bg: "#dcfce7", border: "#bbf7d0" },
    violation: { label: "🚨 Violation", color: "#b91c1c", bg: "#fee2e2", border: "#fecaca" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── API Keys ─────────────────────────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const BESTBUY_API_KEY = import.meta.env.VITE_BESTBUY_API_KEY || "";
const EBAY_CLIENT_ID = import.meta.env.VITE_EBAY_CLIENT_ID || "";
const EBAY_CLIENT_SECRET = import.meta.env.VITE_EBAY_CLIENT_SECRET || "";

// Domain lookup is now via RETAILER_MAP[name]?.domain

function parseGeminiResponse(data) {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    // Skip thought parts — Gemini 2.5-flash emits thinking tokens with {thought: true}
    // before the actual response. Grabbing them causes the "not found" example inside
    // the thinking to be mistakenly parsed as the final result.
    const text = parts.find((p) => p.text && !p.thought)?.text;
    if (!text) throw new Error("No text in Gemini response");
    const clean = text.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { const m = clean.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error("Could not parse Gemini response"); }

    return parsed;
}

// Build a retailer-specific search URL from model/name so Gemini has a direct link to follow
function buildSearchUrl(retailer, product) {
    const q = encodeURIComponent([product.model, product.name].filter(Boolean).join(" ").trim());
    if (!q) return null;
    return RETAILER_MAP[retailer]?.searchUrl(q) || null;
}

// ─── Best Buy API ─────────────────────────────────────────────────────────
async function lookupBestBuyPrice(product) {
    if (!BESTBUY_API_KEY) throw new Error("No Best Buy API key");
    // Prefer Customer SKU, then model, then product name
    const query = encodeURIComponent([product.sku, product.model, product.name].filter(Boolean).join(" ").trim());
    const fields = "sku,name,salePrice,regularPrice,onSale,url,onlineAvailability,onSaleEndDate";
    const url = `https://api.bestbuy.com/v1/products(search=${query})?apiKey=${BESTBUY_API_KEY}&show=${fields}&format=json&pageSize=3&sort=relevanceScore.dsc`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Best Buy API ${resp.status}`);
    const data = await resp.json();
    const p = data.products?.[0];
    if (!p) return { error: "Not found", productName: product.name, retailer: "Best Buy" };
    const currentPrice = p.salePrice ?? p.regularPrice ?? null;
    const msrp = p.regularPrice ?? null;
    const discountPercent = (msrp && currentPrice && msrp > currentPrice)
        ? Math.round((msrp - currentPrice) / msrp * 1000) / 10
        : (msrp && currentPrice ? 0 : null);
    return {
        productName: p.name,
        retailer: "Best Buy",
        currentPrice,
        msrp,
        discountPercent,
        resultUrl: p.url || `https://www.bestbuy.com/site/searchpage.jsp?st=${query}`,
        inStock: p.onlineAvailability ?? null,
        notes: p.onSale ? "On sale" : "",
        _via: "bestbuy-api",
    };
}

// ─── eBay Browse API ───────────────────────────────────────────────────────
let _ebayToken = null; // { token, expires }
async function _getEbayToken() {
    if (_ebayToken && _ebayToken.expires > Date.now()) return _ebayToken.token;
    if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) throw new Error("No eBay credentials");
    const creds = btoa(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`);
    const resp = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST",
        headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    if (!resp.ok) throw new Error(`eBay token error ${resp.status}`);
    const d = await resp.json();
    _ebayToken = { token: d.access_token, expires: Date.now() + (d.expires_in - 60) * 1000 };
    return _ebayToken.token;
}

async function lookupEbayPrice(product) {
    const token = await _getEbayToken();
    const query = encodeURIComponent([product.sku, product.model, product.name].filter(Boolean).join(" ").trim());
    const resp = await fetch(
        `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&filter=buyingOptions:{FIXED_PRICE}&sort=price&limit=5`,
        { headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } }
    );
    if (!resp.ok) throw new Error(`eBay search error ${resp.status}`);
    const data = await resp.json();
    const items = data.itemSummaries || [];
    if (!items.length) return { error: "Not found", productName: product.name, retailer: "eBay" };
    const item = items[0];
    const currentPrice = parseFloat(item.price?.value ?? 0) || null;
    return {
        productName: item.title,
        retailer: "eBay",
        currentPrice,
        msrp: product.msrp ?? null,
        discountPercent: (product.msrp && currentPrice)
            ? Math.round((product.msrp - currentPrice) / product.msrp * 1000) / 10
            : null,
        resultUrl: item.itemWebUrl,
        inStock: true,
        notes: item.condition || "",
        _via: "ebay-api",
    };
}

// ─── Gemini fallback ────────────────────────────────────────────────────────
async function lookupWithGemini(product, signal) {
    // Use explicit URL > auto-built retailer search URL > text-only search hint
    const explicitUrl = product.url;
    const searchUrl = !explicitUrl ? buildSearchUrl(product.retailer, product) : null;

    const userPrompt = explicitUrl
        ? `Find current price and MSRP at this exact product page: ${explicitUrl}\nRetailer: ${product.retailer || "detect from URL"}`
        : `Find the official Product Details Page (PDP) URL, current price, and MSRP for:\nProduct: ${product.name || "Unknown"}${product.sku ? `\nCustomer Retailer SKU: ${product.sku}` : ""}${product.model ? `\nModel # (6NC): ${product.model}` : ""}${product.upc ? `\nUPC/Barcode: ${product.upc}` : ""}\nRetailer: ${product.retailer}${product.msrp ? `\nKnown MSRP/MAP: $${product.msrp}` : ""}${searchUrl ? `\nHint: You can start by searching here: ${searchUrl}` : ` site:${RETAILER_MAP[product.retailer]?.domain || product.retailer}`}`;

    const prompt = `You are a strict product price and URL extractor. Your absolute first priority is to use Google Search to find the OFFICIAL Product Details Page (PDP) URL for the exact product at ${product.retailer}.
You MUST return the specific product page URL in the \`resultUrl\` field (NOT a search results page). 
CRITICAL: ${product.retailer} often hides active prices in basic search snippets. You MUST hunt for the true active numerical price. Check Google Shopping tabs, carousel results, or competitor listings for the exact same UPC/Model to find the prevailing current price. DO NOT leave currentPrice blank unless the item simply does not exist.

Respond ONLY with valid JSON — no markdown. The JSON must exactly follow this structure:
{"resultUrl":"https://www.target.com/p/full-product-name/-/A-123456","productName":"full name","retailer":"${product.retailer}","currentPrice":99.99,"msrp":129.99,"discountPercent":23.1,"inStock":true,"notes":""}

Rules:
1. resultUrl = The exact, direct product page URL (PDP). DO NOT return a search query URL. This is critical.
2. currentPrice/msrp = numbers or null.
3. discountPercent = ((msrp-currentPrice)/msrp*100) rounded 1 decimal.
4. inStock: true/false/null. If out of stock, STILL return the price if visible.
5. If you absolutely cannot find the product page, return: {"error":"Not found","productName":"${product.name || ""}","retailer":"${product.retailer}"}

${userPrompt}`;

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 0 }, // disable thinking
        },
    };
    const doFetch = () => fetch(GEMINI_URL, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let resp = await doFetch();
    if (!resp.ok) {
        if (resp.status === 429) { await sleep(15000); if (signal?.aborted) throw new DOMException("Aborted", "AbortError"); resp = await doFetch(); }
        if (!resp.ok) { const t = await resp.text().catch(() => ""); throw new Error(`Gemini error ${resp.status}: ${t.slice(0, 200)}`); }
    }
    const parsed = parseGeminiResponse(await resp.json());

    // If the user explicitly provided a URL in the CSV, force it. 
    // Otherwise, trust the AI's resultUrl if it found one. Fallback to searchUrl ONLY if resultUrl is totally empty.
    if (explicitUrl) parsed.resultUrl = explicitUrl;
    else if (!parsed.resultUrl && searchUrl) parsed.resultUrl = searchUrl;

    parsed._via = "gemini";
    return parsed;
}

// ─── Router: Best Buy → eBay → Gemini ────────────────────────────────────
async function lookupProductPrice(product, signal) {
    // Best Buy: use direct API when key is available
    if (product.retailer === "Best Buy" && BESTBUY_API_KEY) {
        try { return await lookupBestBuyPrice(product); }
        catch (e) { console.warn("[Best Buy API] falling back to Gemini:", e.message); }
    }
    // eBay: use Browse API when credentials are available
    if (product.retailer === "eBay" && EBAY_CLIENT_ID && EBAY_CLIENT_SECRET) {
        try { return await lookupEbayPrice(product); }
        catch (e) { console.warn("[eBay API] falling back to Gemini:", e.message); }
    }
    // All other retailers (or fallback): Gemini with Google Search grounding
    return lookupWithGemini(product, signal);
}

// ─── Small Components ──────────────────────────────────────────────────────
function Badge({ retailer }) {
    const c = RETAILER_MAP[retailer]?.color || { bg: "#64748b", text: "#fff" };
    return (
        <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
            {retailer}
        </span>
    );
}

// ─── Settings Panel ────────────────────────────────────────────────────────
function SettingsPanel({ settings, updateSettings }) {
    const [open, setOpen] = useState(false);
    const inp = (field, val) => {
        const n = parseFloat(val);
        if (!isNaN(n) && n >= 0) updateSettings({ [field]: n });
    };
    const numStyle = { width: 56, padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, textAlign: "center" };
    return (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
            <button
                onClick={() => setOpen((o) => !o)}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, color: "#1e293b" }}
            >
                <span>⚙️ Compliance Settings</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{open ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {open && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: 32 }}>
                    {/* Violation Threshold */}
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#475569" }}>Violation Threshold</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input type="range" min={0} max={25} step={0.5} value={settings.violationThreshold}
                                onChange={(e) => updateSettings({ violationThreshold: parseFloat(e.target.value) })}
                                style={{ width: 140 }} />
                            <input type="number" min={0} max={25} step={0.5} value={settings.violationThreshold}
                                onChange={(e) => inp("violationThreshold", e.target.value)}
                                style={numStyle} />
                            <span style={{ fontSize: 13, color: "#64748b" }}>% below MAP</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Prices more than this % below MSRP/MAP are flagged as violations</div>
                    </div>

                    {/* Warning Day Ladder */}
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#475569" }}>Violation Day Ladder</div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            {[
                                { label: "🟡 Warn 1", field: "warn1Day" },
                                { label: "🟠 Warn 2", field: "warn2Day" },
                                { label: "🔴 Warn 3", field: "warn3Day" },
                                { label: "🚨 Escalate", field: "escalateDay" },
                            ].map(({ label, field }) => (
                                <div key={field} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{label}</span>
                                    <input type="number" min={1} max={30} value={settings[field]}
                                        onChange={(e) => inp(field, e.target.value)}
                                        style={{ ...numStyle, width: 48 }} />
                                    <span style={{ fontSize: 10, color: "#94a3b8" }}>day{settings[field] !== 1 ? "s" : ""}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Consecutive violation days before each warning level triggers</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Retailer Selector ─────────────────────────────────────────────────────
function RetailerSelector({ selected, onChange }) {
    const toggle = (name) => onChange((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
    const allInGroup = (retailers) => retailers.every((r) => selected.includes(r.name));
    const toggleGroup = (retailers) => {
        const all = allInGroup(retailers);
        onChange((prev) => all
            ? prev.filter((n) => !retailers.some((r) => r.name === n))
            : [...new Set([...prev, ...retailers.map((r) => r.name)])]);
    };
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {RETAILER_CATEGORIES.map((cat) => (
                <div key={cat.name} style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {cat.emoji} {cat.name}
                        </span>
                        <button
                            onClick={() => toggleGroup(cat.retailers)}
                            style={{ marginLeft: "auto", fontSize: 10, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}
                        >
                            {allInGroup(cat.retailers) ? "None" : "Select All"}
                        </button>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {cat.retailers.map((r) => {
                            const active = selected.includes(r.name);
                            return (
                                <button key={r.name} onClick={() => toggle(r.name)}
                                    style={{ background: active ? r.color.bg : "#fff", color: active ? r.color.text : "#475569", border: `1px solid ${active ? r.color.bg : "#cbd5e1"}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700, fontSize: 11, transition: "all 0.15s", opacity: active ? 1 : 0.7 }}>
                                    {r.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}


function StatusPill({ status }) {
    const map = {
        pending: { bg: "#f1f5f9", text: "#64748b", label: "Pending" },
        running: { bg: "#dbeafe", text: "#1d4ed8", label: "Searching…" },
        done: { bg: "#dcfce7", text: "#15803d", label: "Done" },
        error: { bg: "#fee2e2", text: "#b91c1c", label: "Error" },
    };
    const s = map[status] || map.pending;
    return <span style={{ background: s.bg, color: s.text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
}

function MAPBadge({ discountPercent }) {
    const tier = getMAPTier(discountPercent);
    if (!tier) return <span style={{ color: "#94a3b8" }}>—</span>;
    const t = TIER[tier];
    return (
        <span style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
            {t.label}
        </span>
    );
}

function PriceCell({ value, type }) {
    if (value == null) return <span style={{ color: "#94a3b8" }}>—</span>;
    if (type === "discount") {
        const tier = getMAPTier(value);
        const color = tier === "violation" ? "#b91c1c" : "#16a34a";
        return <span style={{ color, fontWeight: 700 }}>{value.toFixed(1)}%</span>;
    }
    return <span>${Number(value).toFixed(2)}</span>;
}

function KPICard({ label, value, sub, color = "#1e293b", highlight }) {
    return (
        <div className="mobile-kpi" style={{
            background: highlight ? highlight : "#fff",
            borderRadius: 10, border: "1px solid #e2e8f0",
            padding: "18px 22px", flex: "1 1 140px", minWidth: 140,
        }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function WarningBadge({ days }) {
    if (!days || days === 0) return null;
    if (days >= 4) return <span style={{ background: "#7f1d1d", color: "#fff", border: "1px solid #991b1b", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🚨 Escalate · Day {days}</span>;
    const cfg = [null, { bg: "#fef9c3", color: "#a16207", border: "#fde68a", label: "🟡 Warn 1" }, { bg: "#fed7aa", color: "#c2410c", border: "#fdba74", label: "🟠 Warn 2" }, { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca", label: "🔴 Warn 3" }][days];
    return <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>;
}

function DeltaCell({ current, prev }) {
    if (current == null || prev == null) return <span style={{ color: "#94a3b8" }}>—</span>;
    const d = current - prev;
    if (Math.abs(d) < 0.01) return <span style={{ color: "#94a3b8" }}>—</span>;
    return <span style={{ color: d > 0 ? "#16a34a" : "#dc2626", fontWeight: 600, fontSize: 12 }}>{d > 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(2)}</span>;
}

// ─── Stats computation ─────────────────────────────────────────────────────
function useMarketStats(results, streaks = {}) {
    return useMemo(() => {
        const done = results.filter((r) => r.status === "done");
        const withPrice = done.filter((r) => r.discountPercent != null);
        const compliants = withPrice.filter((r) => getMAPTier(r.discountPercent) === "compliant");
        const violations = withPrice.filter((r) => getMAPTier(r.discountPercent) === "violation");
        const escalations = violations.filter((r) => (streaks[getStreakKey(r)]?.consecutiveDays || 0) >= 4).length;

        const uniqueProducts = new Set(done.map((r) => (r.model || r.productName || r.name || "").toLowerCase().trim())).size;
        const complianceRate = withPrice.length > 0 ? ((compliants.length / withPrice.length) * 100).toFixed(1) : null;
        const avgDeviation = withPrice.length > 0 ? (withPrice.reduce((s, r) => s + r.discountPercent, 0) / withPrice.length).toFixed(1) : null;
        const totalViolations = violations.length;

        // Retailer breakdown
        const retailerMap = {};
        withPrice.forEach((r) => {
            const key = r.retailer || "Unknown";
            if (!retailerMap[key]) retailerMap[key] = { retailer: key, skus: 0, violations: 0, totalDev: 0 };
            retailerMap[key].skus++;
            retailerMap[key].totalDev += r.discountPercent;
            if (getMAPTier(r.discountPercent) !== "compliant") retailerMap[key].violations++;
        });
        const retailerStats = Object.values(retailerMap)
            .map((r) => ({
                ...r,
                avgDev: (r.totalDev / r.skus).toFixed(1),
                complianceRate: (((r.skus - r.violations) / r.skus) * 100).toFixed(0),
            }))
            .sort((a, b) => b.avgDev - a.avgDev);

        // Top 10 worst SKU violations
        const top10 = [...withPrice]
            .sort((a, b) => b.discountPercent - a.discountPercent)
            .slice(0, 10);

        return { done, withPrice, compliants, violations, escalations, uniqueProducts, complianceRate, avgDeviation, totalViolations, retailerStats, top10 };
    }, [results, streaks]);
}

// ─── Excel Export ──────────────────────────────────────────────────────────
function buildExcel(results, stats, streaks = {}) {
    const wb = XLSX.utils.book_new();
    const reportDate = new Date().toLocaleDateString();

    // Sheet 1: Summary KPIs
    const summaryRows = [
        { "Report Date": reportDate },
        { "Report Date": "" },
        { "KPI": "Total SKUs Checked", "Value": stats.done.length },
        { "KPI": "Unique Products", "Value": stats.uniqueProducts },
        { "KPI": "MAP Compliance Rate", "Value": stats.complianceRate != null ? `${stats.complianceRate}%` : "N/A" },
        { "KPI": "Avg Deviation vs MSRP/MAP", "Value": stats.avgDeviation != null ? `${stats.avgDeviation}%` : "N/A" },
        { "KPI": "🚨 Violations (≥5%)", "Value": stats.violations.length },
        { "KPI": "✅ Compliant (<5%)", "Value": stats.compliants.length },
        { "KPI": "" },
        { "KPI": "— Retailer Rankings (worst first) —" },
        ...stats.retailerStats.map((r) => ({
            "KPI": r.retailer,
            "Value": `${r.avgDev}% avg deviation | ${r.complianceRate}% compliant | ${r.violations} violations / ${r.skus} SKUs`,
        })),
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows.map((r) => r["KPI"] !== undefined ? r : { "KPI": "", "Value": "" }));
    wsSummary["!cols"] = [{ wch: 34 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Sheet 2: All Results
    const resultCols = (r) => ({
        "MAP Status": getMAPTier(r.discountPercent) ? TIER[getMAPTier(r.discountPercent)].label.replace(/[✅⚠️🚨]/gu, "").trim() : "No Price Data",
        "Days in Violation": (streaks[getStreakKey(r)]?.consecutiveDays || 0) || "",
        "Warning Level": (() => { const d = streaks[getStreakKey(r)]?.consecutiveDays || 0; if (!d) return ""; if (d >= 4) return `Escalate (Day ${d})`; return ["Warn 1", "Warn 2", "Warn 3"][d - 1] || ""; })(),
        "Product Name": r.productName || r.name || "",
        "Retailer": r.retailer || "",
        "Current Price": r.currentPrice != null ? Number(r.currentPrice).toFixed(2) : "",
        "MSRP / MAP": r.msrp != null ? Number(r.msrp).toFixed(2) : "",
        "Deviation %": r.discountPercent != null ? r.discountPercent.toFixed(1) + "%" : "",
        "In Stock": r.inStock === true ? "Yes" : r.inStock === false ? "No" : "",
        "URL": r.resultUrl || "",
        "Model #": r.model || "",
        "SKU": r.sku || "",
        "Lookup Status": r.status,
        "Notes": r.notes || "",
    });
    const wsAll = XLSX.utils.json_to_sheet(results.map(resultCols));
    wsAll["!cols"] = [{ wch: 14 }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 50 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsAll, "All Results");

    // Sheet 3: Violations only (≥5% below MAP)
    const violRows = results
        .filter((r) => getMAPTier(r.discountPercent) === "violation")
        .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0))
        .map(resultCols);
    const wsViol = violRows.length > 0 ? XLSX.utils.json_to_sheet(violRows) : XLSX.utils.json_to_sheet([{ "Note": "No violations found" }]);
    if (violRows.length > 0) wsViol["!cols"] = wsAll["!cols"];
    XLSX.utils.book_append_sheet(wb, wsViol, "Violations");

    // Sheet 4: Retailer Rankings
    const retailerRows = stats.retailerStats.map((r) => ({
        "Retailer": r.retailer,
        "SKUs Checked": r.skus,
        "Violations": r.violations,
        "Compliance Rate": `${r.complianceRate}%`,
        "Avg Deviation": `${r.avgDev}%`,
    }));
    const wsRetailer = retailerRows.length > 0 ? XLSX.utils.json_to_sheet(retailerRows) : XLSX.utils.json_to_sheet([{ "Note": "No data" }]);
    XLSX.utils.book_append_sheet(wb, wsRetailer, "Retailer Rankings");

    XLSX.writeFile(wb, `map-compliance-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── History Tab ───────────────────────────────────────────────────────────
function HistoryTab({ storage, onViewScan, onDeleteScan, onClearHistory }) {
    const { scans } = storage;
    if (scans.length === 0) return (
        <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}><div style={{ fontSize: 44, marginBottom: 12 }}>🕒</div><div style={{ fontSize: 15 }}>No scan history yet — complete a daily scan to start tracking.</div></div>
    );
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 13, color: "#64748b" }}>{scans.length} scan{scans.length !== 1 ? "s" : ""} stored · 90-day rolling</div>
                <button onClick={onClearHistory} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>Clear All</button>
            </div>
            {scans.map((scan) => (
                <div key={scan.id} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${scan.stats.violations > 0 ? "#fecaca" : "#e2e8f0"}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 22 }}>{scan.stats.violations > 0 ? "🚨" : "✅"}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{scan.dateLabel}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{scan.stats.total} SKUs · {scan.stats.violations} violation{scan.stats.violations !== 1 ? "s" : ""} · {scan.stats.complianceRate ?? "—"}% compliant</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => onViewScan(scan)} style={{ background: "#eff6ff", color: "#1d4ed8", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>View</button>
                        <button onClick={() => onDeleteScan(scan.id)} style={{ background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Delete</button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Market Health Tab ─────────────────────────────────────────────────────
function MarketHealthTab({ results, stats }) {
    if (stats.done.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15 }}>Run a price lookup first to see the Market Health report.</div>
            </div>
        );
    }

    const { complianceRate, avgDeviation, totalViolations, uniqueProducts, retailerStats, top10, violations, escalations } = stats;

    // Bar chart data (worst first, max 8)
    const chartData = retailerStats.slice(0, 8).map((r) => ({
        name: r.retailer,
        deviation: parseFloat(r.avgDev),
        complianceRate: parseFloat(r.complianceRate),
    }));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* KPI Cards */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <KPICard label="Unique Products" value={uniqueProducts} sub="distinct SKUs tracked" color="#1e293b" />
                <KPICard
                    label="MAP Compliance Rate"
                    value={complianceRate != null ? `${complianceRate}%` : "—"}
                    sub="of priced SKUs at or above MAP"
                    color={complianceRate >= 90 ? "#15803d" : complianceRate >= 70 ? "#a16207" : "#b91c1c"}
                />
                <KPICard
                    label="Avg Deviation vs MSRP"
                    value={avgDeviation != null ? `${avgDeviation}%` : "—"}
                    sub="avg % below MSRP/MAP"
                    color={avgDeviation <= 5 ? "#15803d" : "#b91c1c"}
                />
                <KPICard label="MAP Violations (≥5%)" value={totalViolations} sub={escalations > 0 ? `🚨 ${escalations} escalated · Day 4+` : totalViolations === 0 ? "all SKUs compliant" : `${totalViolations} SKU${totalViolations !== 1 ? "s" : ""} below MAP`} color={escalations > 0 ? "#7f1d1d" : totalViolations === 0 ? "#15803d" : "#b91c1c"} highlight={escalations > 0 ? "#fff1f2" : totalViolations > 0 ? "#fff5f5" : undefined} />
            </div>

            {/* Retailer Rankings */}
            {retailerStats.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>🏪</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>Retailer Compliance Rankings</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>Ranked by highest average deviation from MAP/MSRP</div>
                        </div>
                    </div>

                    {/* Bar Chart */}
                    {chartData.length > 0 && (
                        <div style={{ padding: "20px 20px 0" }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Avg % Below MAP</div>
                            <ResponsiveContainer width="100%" height={Math.max(chartData.length * 44, 120)}>
                                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 600 }} />
                                    <Tooltip formatter={(v) => [`${v}%`, "Avg Deviation"]} />
                                    <Bar dataKey="deviation" radius={[0, 4, 4, 0]}>
                                        {chartData.map((entry) => (
                                            <Cell
                                                key={entry.name}
                                                fill={entry.deviation >= 5 ? "#ef4444" : "#22c55e"}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    <div style={{ padding: "0 0 4px" }}>
                        <table className="mobile-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "#f8fafc" }}>
                                    {["#", "Retailer", "SKUs Checked", "Violations", "Compliance Rate", "Avg Deviation"].map((h) => (
                                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#475569", fontWeight: 600, borderTop: "1px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 12 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {retailerStats.map((r, i) => {
                                    const tier = parseFloat(r.avgDev) >= 5 ? "violation" : "compliant";
                                    return (
                                        <tr key={r.retailer} style={{ borderTop: "1px solid #f1f5f9", background: tier === "violation" ? "#fff5f5" : "#fff" }}>
                                            <td data-label="#" style={{ padding: "10px 16px", color: "#94a3b8", fontWeight: 600 }}>{i + 1}</td>
                                            <td data-label="Retailer" style={{ padding: "10px 16px" }}><Badge retailer={r.retailer} /></td>
                                            <td data-label="SKUs Checked" style={{ padding: "10px 16px", fontWeight: 600 }}>{r.skus}</td>
                                            <td data-label="Violations" style={{ padding: "10px 16px" }}>
                                                {r.violations > 0
                                                    ? <span style={{ color: "#b91c1c", fontWeight: 700 }}>{r.violations}</span>
                                                    : <span style={{ color: "#15803d" }}>0</span>}
                                            </td>
                                            <td data-label="Compliance Rate" style={{ padding: "10px 16px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 99, height: 6, overflow: "hidden", minWidth: 60 }}>
                                                        <div style={{ height: "100%", width: `${r.complianceRate}%`, borderRadius: 99, background: parseFloat(r.complianceRate) === 100 ? "#22c55e" : "#ef4444" }} />
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: parseFloat(r.complianceRate) === 100 ? "#15803d" : "#b91c1c", minWidth: 36 }}>{r.complianceRate}%</span>
                                                </div>
                                            </td>
                                            <td data-label="Avg Deviation" style={{ padding: "10px 16px" }}>
                                                <span style={{ fontWeight: 700, color: tier === "violation" ? "#b91c1c" : "#15803d" }}>{r.avgDev}%</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Top 10 SKU Violations */}
            {top10.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>🔝</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>Top SKU Violations</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>Highest deviations below MAP/MSRP</div>
                        </div>
                    </div>
                    <div style={{ padding: "0 0 4px" }}>
                        <table className="mobile-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "#f8fafc" }}>
                                    {["#", "Product", "Retailer", "Current Price", "MAP/MSRP", "Deviation", "Status", "Link"].map((h) => (
                                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#475569", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 12 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {top10.map((r, i) => {
                                    const tier = getMAPTier(r.discountPercent);
                                    return (
                                        <tr key={`${r.id}-${i}`} style={{ borderBottom: "1px solid #f1f5f9", background: tier === "violation" ? "#fff5f5" : "#fff" }}>
                                            <td data-label="#" style={{ padding: "10px 14px", color: "#94a3b8", fontWeight: 700 }}>{i + 1}</td>
                                            <td data-label="Product" style={{ padding: "10px 14px", maxWidth: 220 }}>
                                                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.productName || r.name || "—"}</div>
                                                {(r.model || r.sku) && <div style={{ fontSize: 11, color: "#94a3b8" }}>{[r.model && `Model: ${r.model}`, r.sku && `SKU: ${r.sku}`].filter(Boolean).join(" · ")}</div>}
                                            </td>
                                            <td data-label="Retailer" style={{ padding: "10px 14px" }}><Badge retailer={r.retailer} /></td>
                                            <td data-label="Current Price" style={{ padding: "10px 14px", fontWeight: 700, color: tier === "violation" ? "#b91c1c" : "#1e293b" }}><PriceCell value={r.currentPrice} /></td>
                                            <td data-label="MAP/MSRP" style={{ padding: "10px 14px", color: "#64748b" }}><PriceCell value={r.msrp} /></td>
                                            <td data-label="Deviation" style={{ padding: "10px 14px" }}><PriceCell value={r.discountPercent} type="discount" /></td>
                                            <td data-label="Status" style={{ padding: "10px 14px" }}><MAPBadge discountPercent={r.discountPercent} /></td>
                                            <td data-label="Link" style={{ padding: "10px 14px" }}>
                                                {r.resultUrl ? <a href={r.resultUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 12, fontWeight: 600 }}>View ↗</a> : <span style={{ color: "#94a3b8" }}>—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────
export const PriceTracker = ({ onBack }) => {
    const [jobs, setJobs] = useState([]);
    const [results, setResults] = useState([]);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [tab, setTab] = useState("upload");
    const [selectedRetailers, setSelectedRetailers] = useState(() => ["Amazon", "Walmart", "Target", "Best Buy", "Home Depot", "Lowe's"]);
    const [manualInput, setManualInput] = useState("");
    const [defaultBrand, setDefaultBrand] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [violationsOnly, setViolationsOnly] = useState(false);
    const [viewingScan, setViewingScan] = useState(null); // null = current scan
    const [sortCol, setSortCol] = useState(null); // { key, dir: 'asc'|'desc' }
    const [incrementalScan, setIncrementalScan] = useState(false);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const abortRef = useRef(null);
    const fileRef = useRef(null);
    const { storage, saveScan, deleteScan, clearHistory } = usePriceTrackerStorage();
    const { settings, updateSettings } = useSettings();

    // Compute live streaks (current scan increments applied on top of stored streaks)
    const liveStreaks = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        const live = { ...storage.streaks };
        results.filter((r) => r.status === "done" && getMAPTier(r.discountPercent, settings.violationThreshold) === "violation").forEach((r) => {
            const key = getStreakKey(r);
            if (!live[key] || live[key].lastScanDate !== today) {
                live[key] = { ...(live[key] || {}), consecutiveDays: (live[key]?.consecutiveDays || 0) + 1, lastScanDate: today };
            }
        });
        return live;
    }, [storage.streaks, results, settings.violationThreshold]);

    // Previous-scan prices for delta display
    const prevPrices = useMemo(() => {
        const prev = {};
        const prevScan = storage.scans[0]; // most recent stored scan
        if (prevScan) prevScan.results.forEach((r) => { prev[getStreakKey(r)] = r.currentPrice; });
        return prev;
    }, [storage.scans]);

    const toggleRow = useCallback((id) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const getHistoryData = useCallback((item) => {
        const key = getStreakKey(item);
        // We want the past 90 days from storage.scans (they are newest first, so reverse to plot oldest to newest)
        return [...storage.scans].reverse().map(scan => {
            const result = scan.results.find(r => getStreakKey(r) === key);
            if (!result) return null;
            return {
                date: new Date(scan.id).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
                price: parseFloat(result.currentPrice) || null,
                msrp: parseFloat(item.msrp) || null
            };
        }).filter(d => d && d.price !== null);
    }, [storage.scans]);

    const activeResults = viewingScan ? viewingScan.results : results;
    const stats = useMarketStats(activeResults, viewingScan ? {} : liveStreaks);

    const parseFile = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: "binary" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
                const get = (row, ...keys) => {
                    for (const k of keys) {
                        const match = Object.keys(row).find(
                            (rk) => rk.toLowerCase().replace(/[\s_\-]/g, "") === k.toLowerCase().replace(/[\s_\-]/g, "")
                        );
                        if (match && String(row[match]).trim()) return String(row[match]).trim();
                    }
                    return "";
                };
                const parsed = rows
                    .filter((r) => Object.values(r).some((v) => String(v).trim()))
                    .map((r, i) => {
                        const brand = get(r, "brand", "manufacturer", "mfg");
                        const rawName = get(r, "producttitle", "productname", "product", "name", "description", "item", "vendormaterialdescription", "materialdescription", "desc", "title");
                        return {
                            id: i,
                            name: brand && rawName ? `${brand} ${rawName}` : rawName || brand,
                            model: (() => { const m = get(r, "productid", "6nc", "model", "modelnumber", "modelno", "partnumber", "part"); return m.replace(/\.0$/, ""); })(),
                            sku: get(r, "customersku#", "customersku", "sku", "retailersku", "itemno", "asin"),
                            upc: get(r, "upc", "ean", "barcode", "gtin"),
                            url: get(r, "url", "link", "producturl"),
                            retailer: get(r, "account", "retailer", "store", "vendor"),
                            msrp: parseFloat(get(r, "msrp", "map", "mapprice", "retailprice", "suggestedretailprice", "srp")) || null,
                            status: "pending",
                        };
                    });
                setJobs(parsed);
                setResults([]);
                setTab("upload");
            } catch (err) { alert("Could not parse file: " + err.message); }
        };
        reader.readAsBinaryString(file);
    }, []);

    const handleManualInput = () => {
        if (!manualInput.trim() || !defaultBrand.trim()) return;
        const items = manualInput.split(",").map(s => s.trim()).filter(Boolean);
        const newJobs = items.map((item, i) => ({
            id: `manual_${Date.now()}_${i}`,
            name: `${defaultBrand.trim()} ${item}`,
            model: item, sku: "", url: "", retailer: "", msrp: null,
            status: "pending"
        }));
        setJobs(newJobs);
        setResults([]);
        setTab("upload");
        setManualInput("");
    };

    const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); };

    const downloadTemplate = () => {
        const rows = [
            { "Brand": "DeWalt", "Product ID": "DCD777C2", "Vendor Material Description": "Cordless Drill", "MSRP": 129.99 },
            { "Brand": "Samsung", "Product ID": "UN65TU8000", "Vendor Material Description": "65\" 4K TV", "MSRP": 799.99 },
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [{ wch: 15 }, { wch: 16 }, { wch: 35 }, { wch: 14 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Price_List");
        XLSX.writeFile(wb, "price_list_template.xlsx");
    };

    const runLookups = async () => {
        setRunning(true); setResults([]); setTab("results"); setViolationsOnly(false);
        const controller = new AbortController();
        abortRef.current = controller;

        const expanded = [];
        for (const job of jobs) {
            if (job.url || job.retailer) {
                expanded.push({ ...job, retailer: job.retailer || "detect" });
            } else {
                for (const r of selectedRetailers) {
                    expanded.push({ ...job, id: `${job.id}-${r}`, retailer: r, status: "pending" });
                }
            }
        }
        const today = new Date().toISOString().slice(0, 10);
        let skippedCount = 0;
        const jobsToRun = [];

        // Apply incremental scan logic
        for (const job of expanded) {
            if (incrementalScan) {
                const key = getStreakKey(job);
                const prevData = liveStreaks[key];
                const prevPrice = prevPrices[key];

                if (prevData && prevData.lastScanDate === today && prevPrice !== undefined) {
                    // Item was already checked today, mark as done immediately from cache
                    const cachedResult = {
                        ...job,
                        status: "done",
                        currentPrice: prevPrice,
                        discountPercent: job.msrp ? parseFloat(((job.msrp - prevPrice) / job.msrp * 100).toFixed(1)) : null,
                        resultUrl: prevData.lastResultUrl || null,
                        _via: "cache"
                    };
                    setResults((prev) => [...prev, cachedResult]);
                    skippedCount++;
                    continue;
                }
            }
            jobsToRun.push(job);
        }

        setProgress({ done: skippedCount, total: expanded.length });

        for (let i = 0; i < jobsToRun.length; i++) {
            if (controller.signal.aborted) break;
            const job = { ...jobsToRun[i], status: "running" };
            setResults((prev) => { const idx = prev.findIndex((r) => r.id === job.id); if (idx >= 0) { const n = [...prev]; n[idx] = job; return n; } return [...prev, job]; });

            try {
                // ── Cache check ──────────────────────────────────────────────────
                const cached = readCache(job);
                let data;
                if (cached) {
                    data = { ...cached, _via: "cache" };
                } else {
                    data = await lookupProductPrice(job, controller.signal);
                    if (!data.error) writeCache(job, data);
                }
                // ────────────────────────────────────────────────────────────────
                const result = {
                    ...job, status: data.error ? "error" : "done",
                    productName: data.productName || job.name,
                    retailer: data.retailer || job.retailer,
                    currentPrice: data.currentPrice, msrp: data.msrp ?? job.msrp,
                    discountPercent: data.discountPercent,
                    resultUrl: data.resultUrl || data.url || job.url,
                    inStock: data.inStock,
                    notes: data.notes || data.error || "",
                    _via: data._via,
                };
                setResults((prev) => { const idx = prev.findIndex((r) => r.id === job.id); const n = [...prev]; if (idx >= 0) n[idx] = result; else n.push(result); return n; });
            } catch (err) {
                if (err.name === "AbortError") break;
                const result = { ...job, status: "error", notes: err.message };
                setResults((prev) => { const idx = prev.findIndex((r) => r.id === job.id); const n = [...prev]; if (idx >= 0) n[idx] = result; else n.push(result); return n; });
            }
            setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
            if (i < jobsToRun.length - 1) await sleep(2000); // 2 s — Gemini rate limits are ~1M tokens/min
        }
        setRunning(false);
    };

    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    const doneCount = activeResults.filter((r) => r.status === "done").length;
    const errorCount = activeResults.filter((r) => r.status === "error").length;
    const noApiKey = !GEMINI_API_KEY;

    // ── Sort + filter ────────────────────────────────────────────────────────
    const SORT_FNS = {
        product: (r) => (r.productName || r.name || "").toLowerCase(),
        retailer: (r) => (r.retailer || "").toLowerCase(),
        price: (r) => r.currentPrice ?? -Infinity,
        msrp: (r) => r.msrp ?? -Infinity,
        deviation: (r) => r.discountPercent ?? -Infinity,
        status: (r) => r.status,
        mapStatus: (r) => getMAPTier(r.discountPercent) ?? "z",
    };

    const displayedResults = useMemo(() => {
        let base = violationsOnly
            ? activeResults.filter((r) => getMAPTier(r.discountPercent) === "violation")
            : activeResults;
        if (sortCol) {
            const fn = SORT_FNS[sortCol.key];
            base = [...base].sort((a, b) => {
                const va = fn(a); const vb = fn(b);
                if (va < vb) return sortCol.dir === "asc" ? -1 : 1;
                if (va > vb) return sortCol.dir === "asc" ? 1 : -1;
                return 0;
            });
        }
        return base;
    }, [activeResults, violationsOnly, sortCol]);

    const handleSort = (key) => setSortCol((prev) =>
        prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
    const sortIcon = (key) => {
        if (sortCol?.key !== key) return " ↕";
        return sortCol.dir === "asc" ? " ▲" : " ▼";
    };

    // Cost estimator — how many calls will hit Gemini (not cached, not direct API)
    const costEstimate = useMemo(() => {
        const expanded = [];
        for (const job of jobs) {
            if (job.url || job.retailer) { expanded.push(job.retailer || "detect"); }
            else { for (const r of selectedRetailers) expanded.push(r); }
        }
        const bbFree = expanded.filter(r => r === "Best Buy" && BESTBUY_API_KEY).length;
        const ebayFree = expanded.filter(r => r === "eBay" && EBAY_CLIENT_ID).length;
        const cached = expanded.filter((r, i) => {
            const job = jobs[Math.floor(i / Math.max(selectedRetailers.length, 1))] || jobs[0];
            return !!readCache({ ...job, retailer: r });
        }).length;
        const geminiCalls = Math.max(0, expanded.length - bbFree - ebayFree - cached);
        const estCost = (geminiCalls * 0.0004).toFixed(2); // ~$0.0004/call for flash
        return { total: expanded.length, bbFree, ebayFree, cached, geminiCalls, estCost };
    }, [jobs, selectedRetailers]);

    const tabs = [
        ["upload", "⬆ Upload & Configure"],
        ["results", `📋 Results${activeResults.length > 0 ? ` (${activeResults.length})` : ""}`],
        ["health", `📊 Market Health${stats.totalViolations > 0 ? ` 🚨${stats.totalViolations}` : ""}`],
        ["history", `🕒 History${storage.scans.length > 0 ? ` (${storage.scans.length})` : ""}`],
    ];

    return (
        <div style={{ fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh", background: "#f8fafc" }}>
            <SEO title="MAP / Price Tracker" description="Track MAP and MSRP compliance across Amazon, Walmart, Target, Best Buy, Home Depot, and Lowe's. Upload a spreadsheet to batch-search and generate a Market Health report." />

            {/* Header */}
            <div style={{ background: "#1e293b", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={onBack} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "4px 8px 4px 0" }}>
                    <Icon name="arrow-left" size={16} />
                </button>
                <div style={{ fontSize: 22 }}>🏷️</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>MAP / Retail Price Tracker</div>
                </div>
                {results.length > 0 && (
                    <button
                        onClick={() => buildExcel(activeResults, stats, liveStreaks)}
                        style={{ marginLeft: "auto", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                    >
                        ⬇ Export Report (.xlsx)
                    </button>
                )}
            </div>

            {/* API Key Warning */}
            {noApiKey && (
                <div style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a", padding: "10px 24px", fontSize: 13, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <strong>No Gemini API key found.</strong>&nbsp;Add <code>VITE_GEMINI_API_KEY</code> to your <code>.env</code> file (get one free at <a href="https://aistudio.google.com" target="_blank" style={{ color: "#1d4ed8" }}>aistudio.google.com</a>) and restart.
                </div>
            )}

            {/* Tabs */}
            <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px", display: "flex" }}>
                {tabs.map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        background: "none", border: "none", padding: "12px 18px", cursor: "pointer",
                        fontWeight: tab === t ? 700 : 400, fontSize: 13,
                        color: tab === t ? "#2563eb" : "#64748b",
                        borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent",
                        whiteSpace: "nowrap",
                    }}>
                        {label}
                    </button>
                ))}
            </div>

            <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

                {/* ── UPLOAD TAB ─────────────────────────────────────── */}
                {tab === "upload" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                        {/* ── Step Guide ─────────────────────────────── */}
                        <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: 12, padding: "20px 24px", color: "#fff" }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>How to Run a Price Check</div>
                            <div style={{ display: "flex", gap: 0, alignItems: "stretch", flexWrap: "wrap" }}>
                                {[
                                    { n: "1", title: "Configure (Optional)", desc: "Set your violation % threshold and warning days" },
                                    { n: "2", title: "Select Retailers", desc: "Choose which stores to search across" },
                                    { n: "3", title: "Enter Products", desc: "Type SKUs / names or upload a price list Excel file" },
                                    { n: "4", title: "Run Lookup", desc: "Click Start — results populate in the Results tab" },
                                ].map((s, i, arr) => (
                                    <div key={s.n} style={{ display: "flex", alignItems: "center", flex: "1 1 180px" }}>
                                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "0 16px 0 0" }}>
                                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{s.n}</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.title}</div>
                                                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{s.desc}</div>
                                            </div>
                                        </div>
                                        {i < arr.length - 1 && <div style={{ color: "#475569", fontSize: 18, marginRight: 16, flexShrink: 0 }}>›</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Step 1: Settings ────────────────────────── */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#64748b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>1</div>
                                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Compliance Settings</div>
                                <span style={{ fontSize: 12, color: "#94a3b8" }}>Optional</span>
                            </div>
                            <SettingsPanel settings={settings} updateSettings={updateSettings} />
                        </div>

                        {/* ── Step 2: Select Retailers ────────────────── */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>2</div>
                                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Select Retailers</div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>({selectedRetailers.length} of {ALL_RETAILERS.length} selected)</div>
                                <button onClick={() => setSelectedRetailers(ALL_RETAILERS.map(r => r.name))} style={{ marginLeft: "auto", fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Select All</button>
                                <button onClick={() => setSelectedRetailers([])} style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>Clear All</button>
                            </div>
                            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px" }}>
                                <RetailerSelector selected={selectedRetailers} onChange={setSelectedRetailers} />
                            </div>
                        </div>

                        {/* ── Step 3: Enter Products ──────────────────── */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>3</div>
                                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Enter Products</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                {/* Quick Search — Primary */}
                                <div style={{ background: "#fff", border: "2px solid #2563eb", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 20 }}>🔍</span>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Quick Search</div>
                                        <span style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>RECOMMENDED</span>
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>Required: Enter the Brand, then a list of SKUs/Models below.</div>
                                    <input
                                        type="text"
                                        placeholder="Brand / Manufacturer (Required)"
                                        value={defaultBrand}
                                        onChange={(e) => setDefaultBrand(e.target.value)}
                                        style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit", marginBottom: 8 }}
                                    />
                                    <textarea
                                        value={manualInput}
                                        onChange={(e) => setManualInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleManualInput(); }}
                                        placeholder={"e.g.\n458471, DCD777C2, Hue Bridge"}
                                        style={{ flex: 1, minHeight: 90, padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit", resize: "vertical", marginBottom: 12, lineHeight: 1.6 }}
                                    />
                                    <button
                                        onClick={handleManualInput}
                                        disabled={!manualInput.trim() || !defaultBrand.trim()}
                                        style={{ background: manualInput.trim() && defaultBrand.trim() ? "#2563eb" : "#94a3b8", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, cursor: manualInput.trim() && defaultBrand.trim() ? "pointer" : "not-allowed", transition: "all 0.15s" }}
                                    >
                                        Load Products →
                                    </button>
                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, textAlign: "center" }}>Tip: ⌘+Enter to load</div>
                                </div>

                                {/* File Upload — Secondary */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileRef.current?.click()}
                                        style={{ border: `2px dashed ${dragOver ? "#2563eb" : "#cbd5e1"}`, borderRadius: 12, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: dragOver ? "#eff6ff" : "#f8fafc", transition: "all 0.2s", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
                                    >
                                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) parseFile(e.target.files[0]); }} />
                                        <div style={{ fontSize: 32, marginBottom: 6 }}>📂</div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 3 }}>Upload Excel / CSV</div>
                                        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 10 }}>Drag & drop or click to browse<br />.xlsx, .xls, .csv</div>
                                        <button onClick={(e) => { e.stopPropagation(); downloadTemplate(); }} style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer", color: "#475569" }}>⬇ Download Template</button>
                                    </div>
                                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px", fontSize: 12, color: "#166534" }}>
                                        <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 Preferred Format (Order matters):</div>
                                        <div style={{ marginBottom: 12, fontSize: 11, color: "#15803d", background: "#dcfce7", padding: "6px 8px", borderRadius: 4 }}>
                                            <strong>Note:</strong> <strong>Product ID</strong> can be a Vendor Model, UPC, or Retailer SKU ID.
                                        </div>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, background: "#fff", borderRadius: 4, overflow: "hidden" }}>
                                            <thead>
                                                <tr style={{ background: "#dcfce7", borderBottom: "1px solid #bbf7d0" }}>
                                                    <th style={{ padding: "4px 8px", textAlign: "left" }}>Brand</th>
                                                    <th style={{ padding: "4px 8px", textAlign: "left" }}>Product ID</th>
                                                    <th style={{ padding: "4px 8px", textAlign: "left" }}>Vendor Material Description</th>
                                                    <th style={{ padding: "4px 8px", textAlign: "left" }}>MSRP</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>DeWalt</td>
                                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>DCD777C2</td>
                                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>Cordless Drill</td>
                                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>129.99</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 16 }}>💾</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, color: "#1e293b" }}>Saved Lists</div>
                                            {(!storage.savedLists || storage.savedLists.length === 0) ? (
                                                <div style={{ color: "#94a3b8", fontSize: 11 }}>No saved lists yet.</div>
                                            ) : (
                                                <select
                                                    onChange={(e) => {
                                                        const listId = e.target.value;
                                                        if (!listId) return;
                                                        const list = storage.savedLists.find(l => l.id === listId);
                                                        if (list) setJobs(list.items);
                                                        e.target.value = "";
                                                    }}
                                                    style={{ width: "100%", marginTop: 4, padding: "4px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12 }}
                                                >
                                                    <option value="">Select a list to load...</option>
                                                    {storage.savedLists.map((l) => (
                                                        <option key={l.id} value={l.id}>{l.name} ({l.items.length} items)</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Loaded Products Preview + Launch ─────────── */}
                        {jobs.length > 0 && (
                            <div style={{ background: "#fff", borderRadius: 12, border: "2px solid #2563eb", padding: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>
                                            ✅ {jobs.length} product{jobs.length !== 1 ? "s" : ""} ready
                                        </div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                            Will be checked across {selectedRetailers.length} retailer{selectedRetailers.length !== 1 ? "s" : ""} — {jobs.length * selectedRetailers.length} total lookups
                                        </div>
                                        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                                            {costEstimate.bbFree > 0 && <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>Best Buy: {costEstimate.bbFree} (Free)</span>}
                                            {costEstimate.ebayFree > 0 && <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>eBay: {costEstimate.ebayFree} (Free)</span>}
                                            {costEstimate.cached > 0 && <span style={{ fontSize: 11, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>⚡ Cached: {costEstimate.cached} (Free)</span>}
                                            {costEstimate.geminiCalls > 0 && <span style={{ fontSize: 11, background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>🧠 AI: {costEstimate.geminiCalls} (~${costEstimate.estCost})</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            {!running && (
                                                <button
                                                    onClick={() => {
                                                        const name = prompt("Enter a name for this list:");
                                                        if (name) saveList({ id: new Date().toISOString(), name, items: jobs });
                                                    }}
                                                    style={{ background: "#fff", color: "#2563eb", border: "1px solid #2563eb", borderRadius: 8, padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
                                                >
                                                    💾 Save List
                                                </button>
                                            )}
                                            <button
                                                onClick={running ? () => { abortRef.current?.abort(); setRunning(false); } : runLookups}
                                                disabled={selectedRetailers.length === 0 || noApiKey}
                                                title={noApiKey ? "Add VITE_GEMINI_API_KEY to .env to enable lookups" : undefined}
                                                style={{ background: running ? "#dc2626" : (noApiKey || selectedRetailers.length === 0 ? "#94a3b8" : "#16a34a"), color: "#fff", border: "none", borderRadius: 8, padding: "12px 28px", cursor: (selectedRetailers.length === 0 || noApiKey) ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 15 }}
                                            >
                                                {running ? "⏹ Stop Lookup" : "▶ Start Price Lookup"}
                                            </button>
                                        </div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                                            <input
                                                type="checkbox"
                                                checked={incrementalScan}
                                                onChange={(e) => setIncrementalScan(e.target.checked)}
                                                style={{ width: 14, height: 14, accentColor: "#2563eb", cursor: "pointer", margin: 0 }}
                                            />
                                            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Incremental Scan (Skip checks from today)</span>
                                        </label>
                                    </div>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: "#f8fafc" }}>
                                                {["#", "Product Name", "Model #", "MSRP", "Retailer", "URL"].map((h) => (
                                                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#475569", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {jobs.slice(0, 10).map((j, i) => (
                                                <tr key={j.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                    <td style={{ padding: "7px 12px", color: "#94a3b8" }}>{i + 1}</td>
                                                    <td style={{ padding: "7px 12px" }}>{j.name || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                                    <td style={{ padding: "7px 12px", fontFamily: "monospace", fontSize: 12 }}>{j.model || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                                    <td style={{ padding: "7px 12px" }}>{j.msrp != null ? `$${Number(j.msrp).toFixed(2)}` : <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                                    <td style={{ padding: "7px 12px" }}>{j.retailer ? <Badge retailer={j.retailer} /> : <span style={{ color: "#94a3b8" }}>all selected</span>}</td>
                                                    <td style={{ padding: "7px 12px" }}>{j.url ? <a href={j.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 12 }}>link ↗</a> : <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {jobs.length > 10 && <div style={{ padding: "8px 12px", color: "#94a3b8", fontSize: 12 }}>…and {jobs.length - 10} more rows</div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── RESULTS TAB ─────────────────────────────────────── */}
                {tab === "results" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Progress */}
                        {progress.total > 0 && (
                            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 18 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                                    <span style={{ fontWeight: 600 }}>
                                        {running ? `Processing… ${progress.done} / ${progress.total}` : `Complete — ${doneCount} found, ${errorCount} errors`}
                                    </span>
                                    <span style={{ color: "#64748b" }}>{pct}%</span>
                                </div>
                                <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, overflow: "hidden" }}>
                                    <div style={{ background: running ? "#2563eb" : "#16a34a", height: "100%", width: `${pct}%`, transition: "width 0.4s", borderRadius: 99 }} />
                                </div>
                            </div>
                        )}

                        {results.length === 0 && !running && (
                            <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>
                                <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
                                <div style={{ fontSize: 15 }}>No results yet — upload a file and start a lookup.</div>
                            </div>
                        )}

                        {results.length > 0 && (
                            <>
                                {/* Summary pills + filter */}
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                    {[
                                        { label: "✅ Compliant", value: stats.compliants.length, color: "#15803d", bg: "#dcfce7" },
                                        { label: "🚨 Violations (≥5%)", value: stats.violations.length, color: "#b91c1c", bg: "#fee2e2" },
                                        { label: "Errors", value: errorCount, color: "#64748b", bg: "#f1f5f9" },
                                        { label: "🧠 via AI", value: results.filter(r => r._via === "gemini").length, color: "#6d28d9", bg: "#f5f3ff" },
                                        { label: "⚡ Cached", value: results.filter(r => r._via === "cache").length, color: "#0369a1", bg: "#e0f2fe" },
                                    ].map((s) => (
                                        <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: "8px 16px" }}>
                                            <span style={{ fontSize: 12, color: s.color, fontWeight: 700 }}>{s.label}: {s.value}</span>
                                        </div>
                                    ))}
                                    {/* Actions */}
                                    <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                                        {!viewingScan && !running && results.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    saveScan(results);
                                                    alert("Results successfully saved to History!");
                                                }}
                                                style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                                            >
                                                💾 Save to History
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setViolationsOnly((v) => !v)}
                                            style={{ background: violationsOnly ? "#fee2e2" : "#f1f5f9", color: violationsOnly ? "#b91c1c" : "#475569", border: `1px solid ${violationsOnly ? "#fecaca" : "#e2e8f0"}`, borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                                        >
                                            {violationsOnly ? "🚨 Violations Only" : "All Results"}
                                        </button>
                                    </div>
                                </div>

                                {/* Results table */}
                                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                                    <div style={{ overflowX: "auto" }}>
                                        <table className="mobile-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ background: "#f8fafc" }}>
                                                    {[
                                                        { label: "Status", sortKey: "status" },
                                                        { label: "MAP Status", sortKey: "mapStatus" },
                                                        ...(!viewingScan ? [{ label: "Streak", sortKey: null }, { label: "Δ vs Prev", sortKey: null }] : []),
                                                        { label: "Product", sortKey: "product" },
                                                        { label: "Retailer", sortKey: "retailer" },
                                                        { label: "Price", sortKey: "price" },
                                                        { label: "MAP/MSRP", sortKey: "msrp" },
                                                        { label: "Deviation", sortKey: "deviation" },
                                                        { label: "In Stock", sortKey: null },
                                                        { label: "Link", sortKey: null },
                                                    ].map(({ label, sortKey }) => (
                                                        <th key={label}
                                                            onClick={sortKey ? () => handleSort(sortKey) : undefined}
                                                            style={{ padding: "10px 12px", textAlign: "left", color: sortKey ? "#2563eb" : "#475569", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 12, cursor: sortKey ? "pointer" : "default", userSelect: "none" }}
                                                        >
                                                            {label}{sortKey ? sortIcon(sortKey) : ""}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {displayedResults.map((r, i) => {
                                                    const tier = getMAPTier(r.discountPercent);
                                                    const rowBg = r.status === "done"
                                                        ? tier === "violation" ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#fafafa"
                                                        : i % 2 === 0 ? "#fff" : "#fafafa";
                                                    const isExpanded = expandedRows.has(r.id);
                                                    const historyData = isExpanded ? getHistoryData(r) : [];

                                                    return (
                                                        <React.Fragment key={r.id}>
                                                            <tr onClick={() => toggleRow(r.id)} style={{ borderBottom: isExpanded ? "none" : "1px solid #f1f5f9", background: rowBg, cursor: "pointer", transition: "all 0.2s" }}>
                                                                <td data-label="Status" style={{ padding: "9px 12px" }}>
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                        <span style={{ fontSize: 10, color: "#94a3b8", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
                                                                        <StatusPill status={r.status} />
                                                                    </div>
                                                                </td>
                                                                <td data-label="MAP Status" style={{ padding: "9px 12px" }}><MAPBadge discountPercent={r.discountPercent} /></td>
                                                                {!viewingScan && <td data-label="Streak" style={{ padding: "9px 12px" }}><WarningBadge days={liveStreaks[getStreakKey(r)]?.consecutiveDays || 0} /></td>}
                                                                {!viewingScan && <td data-label="Δ vs Prev" style={{ padding: "9px 12px" }}><DeltaCell current={r.currentPrice} prev={prevPrices[getStreakKey(r)]} /></td>}
                                                                <td data-label="Product" style={{ padding: "9px 12px", maxWidth: 300 }}>
                                                                    <div style={{ display: "block" }}>
                                                                        <div title={r.productName || r.name || "—"} style={{ fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal", wordBreak: "break-word" }}>{r.productName || r.name || "—"}</div>
                                                                        {(r.model || r.sku) && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{[r.model && `Model: ${r.model}`, r.sku && `SKU: ${r.sku}`].filter(Boolean).join(" · ")}</div>}
                                                                        {r.status === "error" && r.notes && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{r.notes}</div>}
                                                                    </div>
                                                                </td>
                                                                <td data-label="Retailer" style={{ padding: "9px 12px" }}><Badge retailer={r.retailer} /></td>
                                                                <td data-label="Price" style={{ padding: "9px 12px", fontWeight: 600 }}><PriceCell value={r.currentPrice} /></td>
                                                                <td data-label="MAP/MSRP" style={{ padding: "9px 12px", color: "#64748b" }}><PriceCell value={r.msrp} /></td>
                                                                <td data-label="Deviation" style={{ padding: "9px 12px" }}><PriceCell value={r.discountPercent} type="discount" /></td>
                                                                <td data-label="In Stock" style={{ padding: "9px 12px" }}>
                                                                    {r.inStock === true ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Yes</span> : r.inStock === false ? <span style={{ color: "#dc2626" }}>✗ No</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                                                                </td>
                                                                <td data-label="Link" style={{ padding: "9px 12px" }}>
                                                                    {r.resultUrl ? <a href={r.resultUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#2563eb", fontSize: 12, fontWeight: 600 }}>View ↗</a> : <span style={{ color: "#94a3b8" }}>—</span>}
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr style={{ background: rowBg, borderBottom: "1px solid #f1f5f9" }}>
                                                                    <td colSpan={viewingScan ? 9 : 11} style={{ padding: "0 12px 16px 36px" }}>
                                                                        <div style={{ background: "#f8fafc", borderRadius: 8, padding: 16, border: "1px solid #e2e8f0" }}>
                                                                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", marginBottom: 12 }}>90-Day Price History ({r.retailer})</div>
                                                                            {historyData.length > 1 ? (
                                                                                <ResponsiveContainer width="100%" height={160}>
                                                                                    <LineChart data={historyData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                                                                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                                                                        <Tooltip
                                                                                            formatter={(val, name) => [`$${val}`, name === 'price' ? 'Price' : 'MSRP']}
                                                                                            labelStyle={{ color: '#1e293b', fontWeight: 600, fontSize: 12 }}
                                                                                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                                                        />
                                                                                        <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                                                                        {historyData.some(d => d.msrp) && (
                                                                                            <Line type="stepAfter" dataKey="msrp" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                                                                                        )}
                                                                                    </LineChart>
                                                                                </ResponsiveContainer>
                                                                            ) : (
                                                                                <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", padding: 10 }}>Not enough historical data to chart yet. Check back tomorrow!</div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {displayedResults.length === 0 && (
                                                    <tr><td colSpan={viewingScan ? 9 : 11} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No violations found 🎉</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── MARKET HEALTH TAB ───────────────────────────────── */}
                {tab === "health" && <MarketHealthTab results={activeResults} stats={stats} />}

                {/* ── HISTORY TAB ─────────────────────────────────────── */}
                {tab === "history" && (
                    <HistoryTab
                        storage={storage}
                        onViewScan={(scan) => { setViewingScan(scan); setTab("results"); setViolationsOnly(false); }}
                        onDeleteScan={deleteScan}
                        onClearHistory={clearHistory}
                    />
                )}
            </div>
        </div>
    );
};
