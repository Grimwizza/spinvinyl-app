import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Server, MapPin, BarChart3, Globe, Network, Filter, X, Loader2, Activity, Building2, Search, Maximize2, Minimize2, Copy, Check, Users, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import L from 'leaflet';
import { REAL_DATA_CENTERS, DATA_CENTER_METADATA } from '../../data/realDataCenters';
import Fuse from 'fuse.js';
// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper to update map view
function MapUpdater({ center, zoom, bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
        } else if (center) {
            map.flyTo(center, zoom, { duration: 1.5 });
        }
    }, [center, zoom, bounds, map]);
    return null;
}

// Helper functions for stats and flags
const getCountryFlag = (country) => {
    const flags = {
        'USA': '🇺🇸',
        'United States': '🇺🇸',
        'Netherlands': '🇳🇱',
        'Japan': '🇯🇵',
        'Sweden': '🇸🇪',
        'Germany': '🇩🇪',
        'Singapore': '🇸🇬',
        'Australia': '🇦🇺',
        'UK': '🇬🇧',
        'United Kingdom': '🇬🇧',
        'China': '🇨🇳',
        'Ireland': '🇮🇪',
        'Canada': '🇨🇦',
        'France': '🇫🇷',
        'India': '🇮🇳',
        'Brazil': '🇧🇷',
        'Chile': '🇨🇱',
        'South Africa': '🇿🇦',
        'Kenya': '🇰🇪',
        'Indonesia': '🇮🇩',
        'UAE': '🇦🇪',
        'Saudi Arabia': '🇸🇦',
        'South Korea': '🇰🇷',
        'Taiwan': '🇹🇼'
    };
    return flags[country] || '🌐';
};

// Maps provider to their headquarters country
const getProviderCountry = (provider) => {
    const providerCountries = {
        'Microsoft Azure': 'USA',
        'Google Cloud': 'USA',
        'AWS': 'USA',
        'Meta': 'USA',
        'Oracle Cloud': 'USA',
        'xAI': 'USA',
        'CoreWeave': 'USA',
        'Tesla': 'USA',
        'Alibaba Cloud': 'China',
        'Yotta': 'India',
        'SoftBank': 'Japan'
    };
    return providerCountries[provider] || 'USA';
};

// Provider colors for custom markers
const providerColors = {
    'Microsoft Azure': '#0078d4',
    'Google Cloud': '#4285f4',
    'AWS': '#ff9900',
    'Meta': '#1877f2',
    'Oracle Cloud': '#f80000',
    'xAI': '#000000',
    'CoreWeave': '#6366f1',
    'Tesla': '#cc0000',
    'Alibaba Cloud': '#ff6a00',
    'Yotta': '#00a651',
    'SoftBank': '#c8102e'
};

// Create custom colored marker icon
const createProviderIcon = (provider) => {
    const color = providerColors[provider] || '#6366f1';
    const initial = provider.charAt(0).toUpperCase();

    return L.divIcon({
        className: 'custom-provider-marker',
        html: `<div style="
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            background: ${color};
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
        ">
            <span style="
                transform: rotate(45deg);
                color: white;
                font-weight: bold;
                font-size: 12px;
                font-family: system-ui;
            ">${initial}</span>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36]
    });
};

const parsePower = (powerStr) => {
    if (!powerStr) return 0;
    const match = powerStr.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
    }
    return 0;
};

const parseCost = (costStr) => {
    if (!costStr || costStr === 'Unknown') return 0;
    const s = costStr.toLowerCase();
    const match = s.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    if (!match) return 0;
    let val = parseFloat(match[0].replace(/,/g, ''));

    // Scale to Billions
    if (s.includes('trillion')) val *= 1000;
    else if (s.includes('billion')) val *= 1;
    else if (s.includes('million')) val *= 0.001;

    // Currency conversion to USD
    if (costStr.includes('€')) val *= 1.08;
    else if (costStr.includes('£')) val *= 1.27;
    else if (costStr.includes('¥')) val *= 0.0064;
    else if (costStr.includes('kr')) val *= 0.096; // SEK

    return val;
};

// Estimation formulas for missing data
const estimatePower = (dc) => {
    // Base power by type (in MW)
    const typePower = {
        'Training Hub': 150,
        'Supercomputer': 100,
        'AI Factory': 80,
        'Inference Node': 40,
        'AI Campus': 120,
        'HPC Center': 60,
        'Cloud Region': 50
    };

    // Location multiplier (energy costs/cooling needs)
    const locationMultiplier = {
        'USA': 1.0,
        'Sweden': 0.9, // Cool climate
        'Ireland': 0.85,
        'Singapore': 1.2, // Tropical
        'India': 1.1,
        'China': 1.0,
        'Japan': 1.0,
        'Brazil': 1.15,
        'Kenya': 1.1,
        'South Africa': 1.0
    };

    const basePower = typePower[dc.type] || 50;
    const multiplier = locationMultiplier[dc.country] || 1.0;

    return Math.round(basePower * multiplier);
};

const estimateCost = (dc, estimatedPower) => {
    // Cost estimation: ~$15-25M per MW for AI-focused facilities
    // Training hubs are more expensive ($25M/MW), inference nodes cheaper ($15M/MW)
    const costPerMW = {
        'Training Hub': 25,
        'Supercomputer': 22,
        'AI Factory': 20,
        'Inference Node': 15,
        'AI Campus': 20,
        'HPC Center': 18,
        'Cloud Region': 16
    };

    const rate = costPerMW[dc.type] || 18;
    const power = estimatedPower || estimatePower(dc);

    // Cost in millions, convert to billions
    return (power * rate) / 1000;
};

// Get display values with estimation flag
const getDisplayValues = (dc) => {
    const hasPower = dc.size_mw && parsePower(dc.size_mw) > 0;
    const hasCost = dc.cost_estimate && parseCost(dc.cost_estimate) > 0;

    let power, cost, powerEstimated = false, costEstimated = false;

    if (hasPower) {
        power = parsePower(dc.size_mw);
    } else {
        power = estimatePower(dc);
        powerEstimated = true;
    }

    if (hasCost) {
        cost = parseCost(dc.cost_estimate);
    } else {
        cost = estimateCost(dc, power);
        costEstimated = true;
    }

    return {
        power,
        powerStr: hasPower ? dc.size_mw : `~${power} MW`,
        powerEstimated,
        cost,
        costStr: hasCost ? dc.cost_estimate : `~$${cost.toFixed(1)}B`,
        costEstimated
    };
};

export const DataCenterMap = ({ onBack }) => {
    const [mapView, setMapView] = useState({ center: [39.8283, -98.5795], zoom: 3 });
    const [selectedCountry, setSelectedCountry] = useState(null);
    const [selectedModel, setSelectedModel] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [selectedOrigin, setSelectedOrigin] = useState(null);
    const [dataPoints, setDataPoints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showMethodology, setShowMethodology] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [compareSelection, setCompareSelection] = useState([]);
    const [showComparison, setShowComparison] = useState(false);
    const mapContainerRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [monthlyUsersData, setMonthlyUsersData] = useState(null);
    const [expandedFilter, setExpandedFilter] = useState('origin'); // 'origin', 'provider', 'models', or null
    const [activeMobileStat, setActiveMobileStat] = useState(null); // 'cost', 'power', 'nodes', 'users', or null

    // Auto-dismiss mobile stats tooltip after 3 seconds
    useEffect(() => {
        if (activeMobileStat) {
            const timer = setTimeout(() => setActiveMobileStat(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [activeMobileStat]);

    // Toggle comparison selection (max 3)
    const toggleCompare = (dc) => {
        setCompareSelection(prev => {
            if (prev.find(d => d.id === dc.id)) {
                return prev.filter(d => d.id !== dc.id);
            }
            if (prev.length >= 3) return prev;
            return [...prev, dc];
        });
    };

    // Simulate Live Data Fetching
    useEffect(() => {
        const timer = setTimeout(() => {
            setDataPoints(REAL_DATA_CENTERS);
            setIsLoading(false);
        }, 1200);
        return () => clearTimeout(timer);
    }, []);

    // Fetch monthly users data from API
    useEffect(() => {
        // Baseline data for immediate display (also serves as fallback)
        const baselineData = {
            lastUpdated: new Date().toISOString(),
            models: {
                'GPT-4': { monthlyUsers: 400000000, confidence: 'high' },
                'GPT-3.5': { monthlyUsers: 500000000, confidence: 'high' },
                'Gemini': { monthlyUsers: 350000000, confidence: 'medium' },
                'Gemini Pro': { monthlyUsers: 275000000, confidence: 'medium' },
                'Claude': { monthlyUsers: 25000000, confidence: 'medium' },
                'Claude 3': { monthlyUsers: 25000000, confidence: 'medium' },
                'Llama 2': { monthlyUsers: null, confidence: 'low' },
                'Llama 3': { monthlyUsers: null, confidence: 'low' },
                'Mistral': { monthlyUsers: 15000000, confidence: 'low' },
                'Copilot': { monthlyUsers: 218000000, confidence: 'medium' },
                'Grok': { monthlyUsers: 10000000, confidence: 'low' },
                'DeepSeek': { monthlyUsers: 5000000, confidence: 'low' }
            },
            providers: {
                'OpenAI': { monthlyUsers: 900000000, confidence: 'high' },
                'Google Cloud': { monthlyUsers: 350000000, confidence: 'medium' },
                'Microsoft Azure': { monthlyUsers: 218000000, confidence: 'medium' },
                'Anthropic': { monthlyUsers: 25000000, confidence: 'medium' },
                'Meta': { monthlyUsers: null, confidence: 'low' },
                'xAI': { monthlyUsers: 10000000, confidence: 'low' },
                'Alibaba Cloud': { monthlyUsers: 50000000, confidence: 'low' },
                'AWS': { monthlyUsers: 100000000, confidence: 'low' },
                'Oracle Cloud': { monthlyUsers: 20000000, confidence: 'low' },
                'CoreWeave': { monthlyUsers: null, confidence: 'low' },
                'Tesla': { monthlyUsers: null, confidence: 'low' },
                'SoftBank': { monthlyUsers: null, confidence: 'low' },
                'Yotta': { monthlyUsers: null, confidence: 'low' }
            }
        };

        // Set baseline data immediately
        setMonthlyUsersData(baselineData);

        // Try to fetch updated data from API (works in production/Vercel)
        const fetchMonthlyUsers = async () => {
            try {
                const response = await fetch('/api/ai-usage-stats');
                if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
                    const data = await response.json();
                    setMonthlyUsersData(data);
                }
            } catch (error) {
                console.log('Using baseline monthly users data (API endpoint not available in local dev)');
                // Keep using baseline data
            }
        };
        fetchMonthlyUsers();
    }, []);

    // Parse URL params on initial load
    useEffect(() => {
        const origin = searchParams.get('origin');
        const provider = searchParams.get('provider');
        const model = searchParams.get('model');
        if (origin) setSelectedOrigin(origin);
        if (provider) setSelectedProvider(provider);
        if (model) setSelectedModel(model);
    }, []);

    // Update URL when filters change
    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedOrigin) params.set('origin', selectedOrigin);
        if (selectedProvider) params.set('provider', selectedProvider);
        if (selectedModel) params.set('model', selectedModel);
        setSearchParams(params, { replace: true });
    }, [selectedOrigin, selectedProvider, selectedModel]);

    // Copy link handler
    const copyShareLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Fuse.js search instance
    const fuse = useMemo(() => {
        return new Fuse(dataPoints, {
            keys: ['name', 'provider', 'location_text', 'country', 'models'],
            threshold: 0.3,
            includeScore: true
        });
    }, [dataPoints]);

    // Search results
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return fuse.search(searchQuery).slice(0, 8);
    }, [searchQuery, fuse]);

    // Extract unique models
    const allModels = useMemo(() => {
        const models = new Set();
        dataPoints.forEach(dc => dc.models.forEach(m => models.add(m)));
        return Array.from(models).sort();
    }, [dataPoints]);

    // Map AI service providers to their infrastructure providers
    const AI_SERVICE_TO_INFRA = {
        'OpenAI': ['Microsoft Azure', 'Oracle Cloud'], // GPT models run on Azure + Oracle
        'Anthropic': ['AWS'], // Claude models run on AWS
        'Google AI': ['Google Cloud'], // Gemini models
        'Meta AI': ['Meta'] // Llama models
    };

    // Extract unique providers (include both infrastructure and AI service providers)
    const allProviders = useMemo(() => {
        const infraProviders = Array.from(new Set(dataPoints.map(dc => dc.provider)));
        const aiServiceProviders = Object.keys(AI_SERVICE_TO_INFRA);
        // Combine and sort, putting AI service providers first
        return [...aiServiceProviders, ...infraProviders].filter((v, i, a) => a.indexOf(v) === i).sort();
    }, [dataPoints]);

    // Extract unique provider origin countries
    const allOrigins = useMemo(() => {
        const origins = new Set(dataPoints.map(dc => getProviderCountry(dc.provider)));
        return Array.from(origins).sort();
    }, [dataPoints]);

    // Filter Logic
    const filteredCenters = useMemo(() => {
        return dataPoints.filter(dc => {
            const matchModel = selectedModel ? dc.models.includes(selectedModel) : true;

            // Handle AI service provider mapping (e.g., OpenAI → Azure + Oracle)
            let matchProvider = true;
            if (selectedProvider) {
                if (AI_SERVICE_TO_INFRA[selectedProvider]) {
                    // AI service provider: match if data center provider is in the infrastructure list
                    matchProvider = AI_SERVICE_TO_INFRA[selectedProvider].includes(dc.provider);
                } else {
                    // Infrastructure provider: exact match
                    matchProvider = dc.provider === selectedProvider;
                }
            }

            const matchOrigin = selectedOrigin ? getProviderCountry(dc.provider) === selectedOrigin : true;
            return matchModel && matchProvider && matchOrigin;
        });
    }, [selectedModel, selectedProvider, selectedOrigin, dataPoints]);

    // Calculate Real-time Stats (includes estimates)
    const stats = useMemo(() => {
        let totalCost = 0;
        let totalPower = 0;
        let totalMonthlyUsers = 0;

        filteredCenters.forEach(dc => {
            const displayValues = getDisplayValues(dc);
            totalCost += displayValues.cost;
            totalPower += displayValues.power;

            // Aggregate monthly users based on models
            if (monthlyUsersData?.models) {
                dc.models.forEach(model => {
                    const userData = monthlyUsersData.models[model];
                    if (userData?.monthlyUsers) {
                        totalMonthlyUsers += userData.monthlyUsers;
                    }
                });
            }
        });

        // Format monthly users (avoid double counting for multi-model centers)
        const uniqueModels = new Set();
        const uniqueProviders = new Set();
        filteredCenters.forEach(dc => {
            dc.models.forEach(m => uniqueModels.add(m));
            uniqueProviders.add(dc.provider);
        });

        // Recalculate to avoid double counting
        let monthlyUsers = 0;
        if (monthlyUsersData?.models && selectedModel) {
            // Single model selected
            const userData = monthlyUsersData.models[selectedModel];
            monthlyUsers = userData?.monthlyUsers || 0;
        } else if (monthlyUsersData?.providers && selectedProvider) {
            // Single provider selected
            const userData = monthlyUsersData.providers[selectedProvider];
            monthlyUsers = userData?.monthlyUsers || 0;
        } else if (monthlyUsersData?.models) {
            // All or filtered: sum unique models
            uniqueModels.forEach(model => {
                const userData = monthlyUsersData.models[model];
                if (userData?.monthlyUsers) {
                    monthlyUsers += userData.monthlyUsers;
                }
            });
        }

        // Format for display
        const formatUsers = (count) => {
            if (count === 0 || !count) return '—';
            if (count >= 1000000000) return `${(count / 1000000000).toFixed(1)}B`;
            if (count >= 1000000) return `${Math.round(count / 1000000)}M`;
            return count.toLocaleString();
        };

        return {
            cost: totalCost.toFixed(1),
            power: (totalPower / 1000).toFixed(2), // Convert MW to GW
            count: filteredCenters.length,
            monthlyUsers: formatUsers(monthlyUsers),
            monthlyUsersRaw: monthlyUsers
        };
    }, [filteredCenters, monthlyUsersData, selectedModel, selectedProvider]);

    // Calculate Statistics for Sidebar
    const countryStats = useMemo(() => {
        const stats = {};
        dataPoints.forEach(dc => {
            stats[dc.country] = (stats[dc.country] || 0) + 1;
        });
        return Object.entries(stats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);
    }, [dataPoints]);

    const handleCountryClick = (country) => {
        setSelectedCountry(country);
        setSelectedModel(null);
        setSelectedProvider(null);

        const dcInCountry = dataPoints.find(dc => dc.country === country);
        if (dcInCountry) {
            let zoom = 5;
            if (country === 'Singapore') zoom = 11;
            if (country === 'Ireland') zoom = 7;
            if (country === 'Germany') zoom = 6;
            if (country === 'China') zoom = 4;
            setMapView({ center: [dcInCountry.lat, dcInCountry.lng], zoom });
        }
    };

    const handleModelClick = (model) => {
        if (selectedModel === model) {
            setSelectedModel(null);
            setMapView({ center: [39.8283, -98.5795], zoom: 3 });
        } else {
            setSelectedModel(model);
            setSelectedProvider(null);
            setSelectedCountry(null);
        }
    };

    const handleProviderClick = (provider) => {
        if (selectedProvider === provider) {
            setSelectedProvider(null);
            setMapView({ center: [39.8283, -98.5795], zoom: 3 });
        } else {
            setSelectedProvider(provider);
            setSelectedModel(null);
            setSelectedCountry(null);
            setSelectedOrigin(null);
        }
    };

    const handleOriginClick = (origin) => {
        if (selectedOrigin === origin) {
            setSelectedOrigin(null);
            setMapView({ center: [39.8283, -98.5795], zoom: 3 });
        } else {
            setSelectedOrigin(origin);
            setSelectedModel(null);
            setSelectedProvider(null);
            setSelectedCountry(null);
        }
    };

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            mapContainerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Listen for fullscreen exit
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Calculate bounds
    const mapBounds = useMemo(() => {
        if ((selectedModel || selectedProvider || selectedOrigin) && filteredCenters.length > 0) {
            return filteredCenters.map(dc => [dc.lat, dc.lng]);
        }
        return null;
    }, [selectedModel, selectedProvider, filteredCenters]);

    return (
        <section ref={mapContainerRef} className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Header */}
            <div className="border-b border-border bg-card p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack}>
                            <ArrowLeft size={20} />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Globe className="text-primary" size={20} />
                                AI Hyperscale Map
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                A dynamic map that tracks Global AI infrastructure.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col-reverse lg:flex-row relative">
                {/* Left Panel: Filters & Stats */}
                <div className="lg:w-96 w-full bg-card border-r border-border flex flex-col z-10 shadow-lg lg:shadow-none h-[40vh] lg:h-[calc(100vh-80px)] overflow-y-auto">

                    {/* Search Bar */}
                    <div className="p-4 border-b border-border flex-none">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search data centers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute left-0 right-0 mt-2 mx-4 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                {searchResults.map(({ item: dc }) => (
                                    <button
                                        key={dc.name}
                                        onClick={() => {
                                            setSearchQuery('');
                                            setMapView({ center: [dc.lat, dc.lng], zoom: 10 });
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 last:border-b-0 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{getCountryFlag(dc.country)}</span>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{dc.name}</p>
                                                <p className="text-xs text-muted-foreground">{dc.provider} • {dc.location_text}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Country of Origin Filter - Collapsible Accordion */}
                    <div className="border-b border-border flex-none">
                        <button
                            onClick={() => setExpandedFilter(expandedFilter === 'origin' ? null : 'origin')}
                            className="w-full p-4 lg:p-6 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                            <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                                <Globe size={16} /> Country of Origin
                                {selectedOrigin && <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full normal-case">{selectedOrigin}</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                {selectedOrigin && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setSelectedOrigin(null); }}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <X size={12} /> Clear
                                    </span>
                                )}
                                <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${expandedFilter === 'origin' ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        <div className={`grid transition-all duration-200 ${expandedFilter === 'origin' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                                <div className="px-4 lg:px-6 pb-4 lg:pb-6">
                                    {isLoading ? (
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(i => <div key={i} className="h-8 w-20 bg-muted/50 rounded-lg animate-pulse" />)}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {allOrigins.map((origin) => {
                                                const count = dataPoints.filter(dc => getProviderCountry(dc.provider) === origin).length;
                                                return (
                                                    <button
                                                        key={origin}
                                                        onClick={() => handleOriginClick(origin)}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${selectedOrigin === origin
                                                            ? 'bg-primary/10 border-primary text-primary'
                                                            : 'bg-secondary/50 border-transparent hover:border-primary/50'
                                                            }`}
                                                    >
                                                        <span className="text-lg">{getCountryFlag(origin)}</span>
                                                        <span className="text-xs font-medium">{origin}</span>
                                                        <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-full">{count}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Provider Filter Section - Collapsible Accordion */}
                    <div className="border-b border-border flex-none">
                        <button
                            onClick={() => setExpandedFilter(expandedFilter === 'provider' ? null : 'provider')}
                            className="w-full p-4 lg:p-6 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                            <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                                <Building2 size={16} /> Provider
                                {selectedProvider && <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full normal-case">{selectedProvider}</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                {selectedProvider && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setSelectedProvider(null); }}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <X size={12} /> Clear
                                    </span>
                                )}
                                <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${expandedFilter === 'provider' ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        <div className={`grid transition-all duration-200 ${expandedFilter === 'provider' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                                <div className="px-4 lg:px-6 pb-4 lg:pb-6">
                                    {isLoading ? (
                                        <div className="py-2 flex justify-center text-muted-foreground animate-pulse">
                                            <span className="text-xs">Loading providers...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {allProviders.map(provider => (
                                                <button
                                                    key={provider}
                                                    onClick={() => handleProviderClick(provider)}
                                                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${selectedProvider === provider
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-secondary/50 text-secondary-foreground border-transparent hover:border-primary/50'
                                                        }`}
                                                >
                                                    {provider}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Model Filter Section - Collapsible Accordion */}
                    <div className="border-b border-border flex-1 min-h-0">
                        <button
                            onClick={() => setExpandedFilter(expandedFilter === 'models' ? null : 'models')}
                            className="w-full p-4 lg:p-6 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                            <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                                <Network size={16} /> AI Models
                                {selectedModel && <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full normal-case">{selectedModel}</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                {selectedModel && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setSelectedModel(null); }}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <X size={12} /> Clear
                                    </span>
                                )}
                                <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${expandedFilter === 'models' ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        <div className={`grid transition-all duration-200 ${expandedFilter === 'models' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                                <div className="px-4 lg:px-6 pb-4 lg:pb-6">
                                    {isLoading ? (
                                        <div className="py-6 flex justify-center text-muted-foreground animate-pulse">
                                            <span className="text-xs">Updating model registry...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {allModels.map(model => (
                                                <button
                                                    key={model}
                                                    onClick={() => handleModelClick(model)}
                                                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${selectedModel === model
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-secondary/50 text-secondary-foreground border-transparent hover:border-primary/50'
                                                        }`}
                                                >
                                                    {model}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Map */}
                <div className="flex-1 bg-muted/50 relative h-[60vh] lg:h-auto lg:min-h-[500px]">
                    <MapContainer
                        center={mapView.center}
                        zoom={mapView.zoom}
                        className="w-full z-0 !h-[60vh] lg:!h-full"
                        style={{ background: '#1c1c1c' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />

                        <MapUpdater center={mapView.center} zoom={mapView.zoom} bounds={mapBounds} />

                        {(selectedModel || selectedProvider || selectedOrigin) && filteredCenters.length > 1 && (
                            <Polyline
                                positions={filteredCenters.map(dc => [dc.lat, dc.lng])}
                                pathOptions={{ color: '#3b82f6', weight: 2, opacity: 0.6, dashArray: '5, 10' }}
                            />
                        )}

                        {filteredCenters.map(dc => (
                            <Marker key={dc.id} position={[dc.lat, dc.lng]} icon={createProviderIcon(dc.provider)}>
                                <Popup
                                    className="custom-popup min-w-[300px]"
                                    offset={[0, 8]}
                                    autoPan={true}
                                    autoPanPadding={[60, 80]}
                                >
                                    <div className="p-2 space-y-2">
                                        {/* Compact Header */}
                                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                            <div className="relative">
                                                <img
                                                    src={dc.logo}
                                                    alt={dc.provider}
                                                    className="w-10 h-10 rounded-lg bg-white p-1 object-contain border shadow-sm"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2ZjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNiAyMlYxMkg0YTIgMiAwIDAgMS0yLTJWNGEyIDIgMCAwIDEgMi0yaDE2YTIgMiAwIDAgMSAyIDJ2OGEyIDIgMCAwIDEtMiAyaC0ydjEwIj48L3BhdGg+PHBhdGggZD0iTTYgMTJoMTIiPjwvcGF0aD48cGF0aCBkPSJNMTAgMTJ2MTAiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTJ2MTAiPjwvcGF0aD48cGF0aCBkPSJNNCA4aDJ2MCI+PC9wYXRoPjxwYXRoIGQ9Ik04IDhoMnYwIj48L3BhdGg+PHBhdGggZD0iTTEyIDhoMnYwIj48L3BhdGg+PHBhdGggZD0iTTE2IDhoMnYwIj48L3BhdGg+PC9zdmc+';
                                                    }}
                                                />
                                                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 border border-white"></span>
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-xs leading-tight text-foreground truncate">{dc.name}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-lg leading-none">{getCountryFlag(dc.country)}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate">{dc.location_text}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleCompare(dc);
                                                }}
                                                className={`p-1 rounded border transition-colors flex-shrink-0 ${compareSelection.find(d => d.id === dc.id)
                                                    ? 'bg-primary border-primary text-primary-foreground'
                                                    : 'border-border hover:border-primary hover:bg-muted'
                                                    }`}
                                                title={compareSelection.find(d => d.id === dc.id) ? 'Remove from comparison' : 'Add to comparison'}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={!!compareSelection.find(d => d.id === dc.id)}
                                                    onChange={() => { }}
                                                    className="pointer-events-none w-3 h-3"
                                                />
                                            </button>
                                        </div>

                                        {/* Compact Metrics - Single Row */}
                                        {(() => {
                                            const displayValues = getDisplayValues(dc);
                                            return (
                                                <div className="grid grid-cols-4 gap-1.5 text-center">
                                                    <div className="bg-muted/30 rounded p-1 border border-border/30">
                                                        <div className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5">Power</div>
                                                        <div className={`text-[10px] font-mono font-bold ${displayValues.powerEstimated ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                            {displayValues.powerStr}
                                                        </div>
                                                    </div>
                                                    <div className="bg-muted/30 rounded p-1 border border-border/30">
                                                        <div className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5">Cost</div>
                                                        <div className={`text-[10px] font-mono font-bold truncate ${displayValues.costEstimated ? 'text-muted-foreground' : 'text-foreground'}`} title={displayValues.costStr}>
                                                            {displayValues.costStr}
                                                        </div>
                                                    </div>
                                                    <div className="bg-muted/30 rounded p-1 border border-border/30">
                                                        <div className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5">Year</div>
                                                        <div className="text-[10px] font-mono font-bold text-foreground">
                                                            {dc.activation_date || 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div className="bg-muted/30 rounded p-1 border border-border/30">
                                                        <div className="text-[8px] uppercase text-muted-foreground font-semibold mb-0.5">Type</div>
                                                        <div className="text-[8px] font-bold text-blue-600 truncate" title={dc.type}>
                                                            {dc.type.replace(' Hub', '').replace(' Node', '')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Insight - Condensed */}
                                        {dc.insight && (
                                            <div className="bg-blue-500/5 border border-blue-200/50 rounded p-1.5">
                                                <p className="text-[10px] text-foreground/90 leading-snug line-clamp-2">{dc.insight}</p>
                                            </div>
                                        )}

                                        {/* Models - Compact */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-semibold text-muted-foreground uppercase">Models</span>
                                                <span className="text-[8px] bg-muted px-1 rounded-full">{dc.models.length}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {dc.models.slice(0, 6).map((m, i) => (
                                                    <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border ${selectedModel === m
                                                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                                                        : 'bg-background text-secondary-foreground border-border/50'
                                                        }`}>
                                                        {m}
                                                    </span>
                                                ))}
                                                {dc.models.length > 6 && (
                                                    <span className="text-[9px] px-1.5 py-0.5 text-muted-foreground">+{dc.models.length - 6}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer Actions - Compact */}
                                        <div className="pt-1.5 border-t border-border/50 flex items-center justify-between gap-2">
                                            <code className="text-[9px] text-muted-foreground font-mono">
                                                {dc.lat.toFixed(3)}, {dc.lng.toFixed(3)}
                                            </code>
                                            <a
                                                href={dc.satellite_url || `https://www.google.com/maps/search/?api=1&query=${dc.lat},${dc.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-blue-600 hover:bg-blue-700 !text-white px-2 py-1 rounded text-[9px] font-semibold inline-flex items-center gap-1 shadow-sm transition-colors"
                                                style={{ color: '#ffffff' }}
                                            >
                                                <Globe size={10} className="text-white" /> <span className="text-white">Satellite</span>
                                            </a>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>


                    {/* Unified Top Stats Bar - Desktop Only */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] hidden md:block max-w-fit" >
                        <div className="bg-card/95 backdrop-blur-xl border border-border/60 shadow-xl rounded-2xl px-6 py-3.5 flex items-center justify-between gap-6">
                            {/* Left: Key Metrics */}
                            <div className="flex items-center gap-5">
                                {/* Investment */}
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase text-muted-foreground font-semibold tracking-widest leading-none mb-0.5">Investment</span>
                                        <span className="text-base font-bold font-mono text-foreground leading-none">
                                            {isLoading ? '—' : `$${stats.cost}B`}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-px h-10 bg-border/50"></div>

                                {/* Power */}
                                <div className="flex items-center gap-2.5 group relative cursor-help">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-colors group-hover:bg-amber-500/20 group-hover:border-amber-500/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase text-muted-foreground font-semibold tracking-widest leading-none mb-0.5 group-hover:text-foreground transition-colors">Power</span>
                                        <span className="text-base font-bold font-mono text-foreground leading-none group-hover:text-amber-500 transition-colors">
                                            {isLoading ? '—' : `${stats.power} GW`}
                                        </span>
                                    </div>

                                    {/* Context Tooltip */}
                                    {!isLoading && stats.power > 0 && (
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 z-[500] scale-95 group-hover:scale-100">
                                            <div className="bg-popover/90 backdrop-blur-md text-popover-foreground text-xs rounded-lg border border-border/50 shadow-xl p-3 text-center">
                                                <div className="font-semibold mb-1 text-amber-500">Power Equivalency</div>
                                                <div className="text-muted-foreground leading-relaxed">
                                                    Enough calculated energy to power <span className="text-foreground font-bold">
                                                        {(stats.power * 0.3).toFixed(1)}M</span> to <span className="text-foreground font-bold">{(stats.power * 1.0).toFixed(1)}M
                                                    </span> average homes.
                                                </div>
                                                {/* Tooltip Arrow */}
                                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover/90 border-t border-l border-border/50 rotate-45"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="w-px h-10 bg-border/50"></div>

                                {/* Nodes */}
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 relative">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase text-muted-foreground font-semibold tracking-widest leading-none mb-0.5">Live Nodes</span>
                                        <span className="text-base font-bold font-mono text-foreground leading-none">
                                            {isLoading ? '—' : stats.count}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-px h-10 bg-border/50"></div>

                                {/* Monthly Users */}
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                        <Users size={16} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase text-muted-foreground font-semibold tracking-widest leading-none mb-0.5">Monthly Users</span>
                                        <span className="text-base font-bold font-mono text-foreground leading-none">
                                            {isLoading || !monthlyUsersData ? '—' : stats.monthlyUsers}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Center: Status Badge - Hidden on mobile */}
                            <div className="hidden md:flex items-center gap-2.5 px-4 py-2 bg-primary/5 border border-primary/20 rounded-xl flex-shrink-0 min-w-0 max-w-[200px]">
                                <Activity size={18} className={`flex-shrink-0 ${isLoading ? 'text-muted-foreground' : 'text-primary animate-pulse'}`} />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-bold font-mono text-foreground tracking-wider leading-none truncate">
                                        {isLoading ? 'CONNECTING...' : `LIVE MAP V${DATA_CENTER_METADATA.version}`}
                                    </span>
                                    {!isLoading && (selectedModel || selectedProvider) && (
                                        <div className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight truncate mt-0.5">
                                            {selectedModel && <span>{selectedModel}</span>}
                                            {selectedModel && selectedProvider && <span>•</span>}
                                            {selectedProvider && <span className="truncate">{selectedProvider}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Action Buttons - Hidden on mobile */}
                            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={copyShareLink}
                                    className="p-2.5 hover:bg-muted/80 rounded-lg transition-all hover:scale-105 active:scale-95"
                                    title={copied ? 'Link copied!' : 'Copy share link'}
                                >
                                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-muted-foreground hover:text-foreground" />}
                                </button>
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-2.5 hover:bg-muted/80 rounded-lg transition-all hover:scale-105 active:scale-95"
                                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                >
                                    {isFullscreen ? <Minimize2 size={16} className="text-muted-foreground hover:text-foreground" /> : <Maximize2 size={16} className="text-muted-foreground hover:text-foreground" />}
                                </button>
                            </div>
                        </div>
                    </div >

                    {/* Mobile Stats Bar - Bottom Position */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] md:hidden w-[95vw]">
                        <div className="bg-card/95 backdrop-blur-xl border border-border/60 shadow-lg rounded-xl px-2 py-1.5 flex items-center justify-around gap-1 relative">

                            {/* Investment */}
                            <button
                                onClick={() => setActiveMobileStat(activeMobileStat === 'cost' ? null : 'cost')}
                                className="flex items-center gap-1 relative"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                                <span className="text-[10px] font-bold font-mono text-foreground">
                                    {isLoading ? '—' : `$${stats.cost}B`}
                                </span>
                                {activeMobileStat === 'cost' && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg whitespace-nowrap border border-border animate-in fade-in zoom-in duration-200">
                                        Total Investment
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-b border-r border-border rotate-45"></div>
                                    </div>
                                )}
                            </button>

                            <div className="w-px h-4 bg-border/50"></div>

                            {/* Power */}
                            <button
                                onClick={() => setActiveMobileStat(activeMobileStat === 'power' ? null : 'power')}
                                className="flex items-center gap-1 relative"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                <span className="text-[10px] font-bold font-mono text-foreground">
                                    {isLoading ? '—' : `${stats.power}GW`}
                                </span>
                                {activeMobileStat === 'power' && !isLoading && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-popover/95 backdrop-blur-md text-popover-foreground text-[10px] rounded-lg border border-border/50 shadow-xl p-2 text-center animate-in fade-in zoom-in duration-200 z-[500]">
                                        <div className="font-semibold mb-1 text-amber-500">Power Equivalency</div>
                                        <div className="text-muted-foreground leading-snug">
                                            Powers <span className="text-foreground font-bold">{(stats.power * 0.3).toFixed(1)}M</span> to <span className="text-foreground font-bold">{(stats.power * 1.0).toFixed(1)}M</span> homes
                                        </div>
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover/95 border-b border-r border-border/50 rotate-45"></div>
                                    </div>
                                )}
                            </button>

                            <div className="w-px h-4 bg-border/50"></div>

                            {/* Nodes */}
                            <button
                                onClick={() => setActiveMobileStat(activeMobileStat === 'nodes' ? null : 'nodes')}
                                className="flex items-center gap-1 relative"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect></svg>
                                <span className="text-[10px] font-bold font-mono text-foreground">
                                    {isLoading ? '—' : stats.count}
                                </span>
                                {activeMobileStat === 'nodes' && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg whitespace-nowrap border border-border animate-in fade-in zoom-in duration-200">
                                        Active Data Centers
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-b border-r border-border rotate-45"></div>
                                    </div>
                                )}
                            </button>

                            <div className="w-px h-4 bg-border/50"></div>

                            {/* Users */}
                            <button
                                onClick={() => setActiveMobileStat(activeMobileStat === 'users' ? null : 'users')}
                                className="flex items-center gap-1 relative"
                            >
                                <Users size={10} className="text-purple-500" />
                                <span className="text-[10px] font-bold font-mono text-foreground">
                                    {isLoading || !monthlyUsersData ? '—' : stats.monthlyUsers}
                                </span>
                                {activeMobileStat === 'users' && (
                                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg whitespace-nowrap border border-border animate-in fade-in zoom-in duration-200">
                                        Monthly Active Users
                                        <div className="absolute -bottom-1 right-2 w-2 h-2 bg-popover border-b border-r border-border rotate-45"></div>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Loading Overlay */}
                    {
                        isLoading && (
                            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[500] flex items-center justify-center">
                                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                    <div className="relative">
                                        <Globe className="text-primary animate-pulse" size={64} />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="animate-spin text-foreground" size={24} />
                                        </div>
                                    </div>
                                    <div className="text-center space-y-1">
                                        <h3 className="text-lg font-bold">Establishing Satellite Connection...</h3>
                                        <p className="text-sm text-muted-foreground">Synchronizing global infrastructure data</p>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Asterisk Footnote - Hidden on mobile to avoid overlap with stats bar */}
                    <div className="absolute bottom-4 left-4 z-[400] hidden md:block">
                        <button
                            onClick={() => setShowMethodology(true)}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                            <span className="text-amber-500">*</span> Some values are estimated
                        </button>
                    </div>

                    {/* Floating Comparison Bar */}
                    {
                        compareSelection.length >= 2 && (
                            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-card border border-border rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={20} className="text-primary" />
                                    <span className="font-semibold">{compareSelection.length} selected</span>
                                </div>
                                <button
                                    onClick={() => setShowComparison(true)}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                                >
                                    Compare
                                </button>
                                <button
                                    onClick={() => setCompareSelection([])}
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                    title="Clear selection"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )
                    }

                    {/* Comparison Modal */}
                    {
                        showComparison && compareSelection.length >= 2 && (
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowComparison(false)}>
                                <div className="bg-card border border-border rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                    <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 size={24} className="text-primary" />
                                            <h3 className="font-bold text-xl">Data Center Comparison</h3>
                                        </div>
                                        <button onClick={() => setShowComparison(false)} className="p-2 hover:bg-muted rounded-lg">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="p-6">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-border">
                                                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Metric</th>
                                                        {compareSelection.map(dc => (
                                                            <th key={dc.id} className="text-left py-3 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <img src={dc.logo} alt={dc.provider} className="w-8 h-8 rounded object-contain bg-white p-1" />
                                                                    <div>
                                                                        <div className="font-bold text-sm">{dc.name}</div>
                                                                        <div className="text-xs text-muted-foreground">{dc.provider}</div>
                                                                    </div>
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* Location */}
                                                    <tr className="border-b border-border/50">
                                                        <td className="py-3 px-4 font-medium">Location</td>
                                                        {compareSelection.map(dc => (
                                                            <td key={dc.id} className="py-3 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <span>{getCountryFlag(dc.country)}</span>
                                                                    <span>{dc.location_text}</span>
                                                                </div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    {/* Type */}
                                                    <tr className="border-b border-border/50">
                                                        <td className="py-3 px-4 font-medium">Type</td>
                                                        {compareSelection.map(dc => (
                                                            <td key={dc.id} className="py-3 px-4">{dc.type}</td>
                                                        ))}
                                                    </tr>
                                                    {/* Power */}
                                                    <tr className="border-b border-border/50">
                                                        <td className="py-3 px-4 font-medium">Power</td>
                                                        {compareSelection.map(dc => {
                                                            const values = getDisplayValues(dc);
                                                            return (
                                                                <td key={dc.id} className="py-3 px-4">
                                                                    <span className={values.powerEstimated ? 'italic text-amber-600' : ''}>
                                                                        {values.powerStr}
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                    {/* Cost */}
                                                    <tr className="border-b border-border/50">
                                                        <td className="py-3 px-4 font-medium">Investment</td>
                                                        {compareSelection.map(dc => {
                                                            const values = getDisplayValues(dc);
                                                            return (
                                                                <td key={dc.id} className="py-3 px-4">
                                                                    <span className={values.costEstimated ? 'italic text-amber-600' : ''}>
                                                                        {values.costStr}
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                    {/* Employees */}
                                                    <tr className="border-b border-border/50">
                                                        <td className="py-3 px-4 font-medium">Employees</td>
                                                        {compareSelection.map(dc => (
                                                            <td key={dc.id} className="py-3 px-4">{dc.employees || 'N/A'}</td>
                                                        ))}
                                                    </tr>
                                                    {/* AI Models */}
                                                    <tr className="border-b border-border/50">
                                                        <td className="py-3 px-4 font-medium">AI Models</td>
                                                        {compareSelection.map(dc => (
                                                            <td key={dc.id} className="py-3 px-4">
                                                                {dc.models && dc.models.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {dc.models.map((model, idx) => (
                                                                            <span key={idx} className="text-xs bg-secondary px-2 py-0.5 rounded">
                                                                                {model}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : 'N/A'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    {/* Activation Date */}
                                                    <tr>
                                                        <td className="py-3 px-4 font-medium">Activated</td>
                                                        {compareSelection.map(dc => (
                                                            <td key={dc.id} className="py-3 px-4">{dc.activation_date || 'N/A'}</td>
                                                        ))}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Methodology Modal */}
                    {
                        showMethodology && (
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowMethodology(false)}>
                                <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                    <div className="p-6 border-b border-border flex items-center justify-between">
                                        <h3 className="font-bold text-lg">Estimation Methodology</h3>
                                        <button onClick={() => setShowMethodology(false)} className="p-1 hover:bg-muted rounded">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="p-6 space-y-6 text-sm">
                                        <p className="text-muted-foreground">
                                            When official data is unavailable, we estimate Power and Cost based on industry benchmarks.
                                            Estimated values are marked with an amber <span className="text-amber-500 font-semibold">Est.</span> badge.
                                        </p>

                                        <div>
                                            <h4 className="font-semibold mb-2 flex items-center gap-2">⚡ Power Estimation</h4>
                                            <p className="text-muted-foreground mb-2">Base power by facility type, adjusted for location:</p>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-border">
                                                        <th className="text-left py-1 font-medium">Facility Type</th>
                                                        <th className="text-right py-1 font-medium">Base Power</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-muted-foreground">
                                                    <tr><td className="py-1">Training Hub</td><td className="text-right">150 MW</td></tr>
                                                    <tr><td className="py-1">AI Campus</td><td className="text-right">120 MW</td></tr>
                                                    <tr><td className="py-1">Supercomputer</td><td className="text-right">100 MW</td></tr>
                                                    <tr><td className="py-1">AI Factory</td><td className="text-right">80 MW</td></tr>
                                                    <tr><td className="py-1">HPC Center</td><td className="text-right">60 MW</td></tr>
                                                    <tr><td className="py-1">Inference Node</td><td className="text-right">40 MW</td></tr>
                                                </tbody>
                                            </table>
                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                <em>Location multipliers: Tropical +15-20%, Cool climates -10-15%</em>
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="font-semibold mb-2 flex items-center gap-2">💰 Cost Estimation</h4>
                                            <p className="text-muted-foreground mb-2">Cost calculated at ~$15-25M per MW:</p>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-border">
                                                        <th className="text-left py-1 font-medium">Facility Type</th>
                                                        <th className="text-right py-1 font-medium">Cost/MW</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-muted-foreground">
                                                    <tr><td className="py-1">Training Hub</td><td className="text-right">$25M</td></tr>
                                                    <tr><td className="py-1">Supercomputer</td><td className="text-right">$22M</td></tr>
                                                    <tr><td className="py-1">AI Factory / Campus</td><td className="text-right">$20M</td></tr>
                                                    <tr><td className="py-1">HPC Center</td><td className="text-right">$18M</td></tr>
                                                    <tr><td className="py-1">Inference Node</td><td className="text-right">$15M</td></tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <p className="text-[10px] text-muted-foreground border-t border-border pt-4">
                                            Sources: Industry reports, public filings, and infrastructure benchmarks.
                                            Actual values may vary. Data updated {DATA_CENTER_METADATA.lastUpdated}.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
            </div >
        </section >
    );
};
