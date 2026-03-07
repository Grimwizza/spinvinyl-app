import React, { useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { SEO } from '../seo-tools/SEOTags';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { AlertTriangle, Shield, Eye, Globe, Newspaper, Users, Briefcase, CheckCircle2, XCircle, Lock, Download, Unlock, Loader2, User } from 'lucide-react';

const steps = {
    INPUT: 'input',
    DISAMBIGUATION: 'disambiguation',
    LOADING: 'loading',
    REPORT: 'report'
};

const RiskBadge = ({ level }) => {
    const colors = {
        High: 'bg-red-500/10 text-red-600 border-red-500/20',
        Medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        Low: 'bg-green-500/10 text-green-600 border-green-500/20'
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[level] || colors.Medium}`}>
            {level} Risk
        </span>
    );
};

const RiskScore = ({ score }) => {
    const percentage = (score / 10) * 100;
    const color = score >= 7 ? 'bg-red-500' : score >= 4 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Privacy Risk Score</span>
                <span className="text-2xl font-bold">{score}/10</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
};

export const FindMe = () => {
    const [step, setStep] = useState(steps.INPUT);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        location: '',
        profession: '',
        ageRange: ''
    });
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    const [loadingStage, setLoadingStage] = useState('');

    // Beta Program access state
    const [hasBetaAccess, setHasBetaAccess] = useState(false);
    const [betaEmail, setBetaEmail] = useState('');
    const [betaSignupStatus, setBetaSignupStatus] = useState('idle');
    const [isPDFGenerating, setIsPDFGenerating] = useState(false);

    // Check beta access on mount
    useEffect(() => {
        const access = localStorage.getItem('aimlow_beta_access');
        const storedEmail = localStorage.getItem('aimlow_beta_email');
        if (access === 'granted') setHasBetaAccess(true);
        if (storedEmail) setBetaEmail(storedEmail);
    }, []);

    // Progress stages for visual feedback
    const progressStages = [
        { id: 'disambiguate', label: 'Finding Profiles', icon: '🔍' },
        { id: 'linkedin', label: 'Searching LinkedIn', icon: '💼' },
        { id: 'social', label: 'Searching Social Media', icon: '📱' },
        { id: 'news', label: 'Searching News', icon: '📰' },
        { id: 'breach', label: 'Checking Data Breaches', icon: '🔒' },
        { id: 'analyze', label: 'Analyzing Results', icon: '🧠' }
    ];

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !agreedToTerms) return;

        setStep(steps.LOADING);
        setLoadingStage('disambiguate');
        setError(null);

        try {
            // Step 1: Get disambiguation candidates
            const disambiguationResponse = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'find-me-disambiguate',
                    payload: {
                        name: formData.name,
                        location: formData.location || null,
                        profession: formData.profession || null
                    }
                })
            });

            const disambiguationData = await disambiguationResponse.json();

            if (!disambiguationResponse.ok || disambiguationData.error) {
                throw new Error(disambiguationData.error || 'Search failed');
            }

            const candidatesList = disambiguationData.result?.candidates || [];

            // If we have multiple candidates, show disambiguation
            if (candidatesList.length > 1) {
                setCandidates(candidatesList);
                setStep(steps.DISAMBIGUATION);
                setLoadingStage('');
            } else if (candidatesList.length === 1) {
                // Only one match, proceed directly
                setSelectedProfile(candidatesList[0]);
                await runFullAnalysis(candidatesList[0]);
            } else {
                // No candidates found, run analysis with original data
                await runFullAnalysis(null);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Something went wrong. Please try again.');
            setStep(steps.INPUT);
            setLoadingStage('');
        }
    };

    const runFullAnalysis = async (profile) => {
        setStep(steps.LOADING);
        setLoadingStage('linkedin');
        setError(null);

        // Simulate progress through stages (the backend does these sequentially)
        const stageTimer = setInterval(() => {
            setLoadingStage(current => {
                if (current === 'linkedin') return 'social';
                if (current === 'social') return 'news';
                if (current === 'news') return 'breach';
                if (current === 'breach') return 'analyze';
                return current;
            });
        }, 2500); // Update stage every 2.5 seconds

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'find-me',
                    payload: {
                        name: formData.name,
                        email: formData.email || null,
                        location: formData.location || null,
                        profession: formData.profession || null,
                        ageRange: formData.ageRange || null,
                        selectedProfile: profile
                    }
                })
            });

            const data = await response.json();
            clearInterval(stageTimer);

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Analysis failed');
            }

            setReport(data.result);
            setStep(steps.REPORT);
            setLoadingStage('');
        } catch (err) {
            clearInterval(stageTimer);
            console.error(err);
            setError(err.message || 'Something went wrong. Please try again.');
            setStep(steps.INPUT);
            setLoadingStage('');
        }
    };

    const handleCandidateSelect = (candidate) => {
        setSelectedProfile(candidate);
        runFullAnalysis(candidate);
    };

    const skipDisambiguation = () => {
        runFullAnalysis(null);
    };

    const resetForm = () => {
        setStep(steps.INPUT);
        setFormData({ name: '', email: '', location: '', profession: '', ageRange: '' });
        setAgreedToTerms(false);
        setCandidates([]);
        setSelectedProfile(null);
        setReport(null);
        setError(null);
        setActiveTab('summary');
        setLoadingStage('');
    };

    // Beta Program signup handler
    const handleBetaSignup = async (e) => {
        e.preventDefault();
        setBetaSignupStatus('loading');
        try {
            await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: betaEmail }),
            });
            localStorage.setItem('aimlow_beta_access', 'granted');
            localStorage.setItem('aimlow_beta_email', betaEmail);
            setHasBetaAccess(true);
            setBetaSignupStatus('success');
        } catch (error) {
            setBetaSignupStatus('error');
            setTimeout(() => setBetaSignupStatus('idle'), 3000);
        }
    };

    // PDF Download handler
    const handleDownloadPDF = () => {
        setIsPDFGenerating(true);
        setTimeout(() => {
            const element = document.getElementById('find-me-report');
            if (!element) {
                setIsPDFGenerating(false);
                return;
            }

            // Generate a safe filename
            const baseName = formData.name ? formData.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_') : 'Digital_Footprint_Report';
            const filename = `${baseName}_Digital_Footprint_Report.pdf`;

            const opt = {
                margin: 0.5,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'] }
            };

            html2pdf().from(element).set(opt).save(filename).then(() => {
                setIsPDFGenerating(false);
            }).catch(err => {
                console.error('PDF Generation failed:', err);
                setIsPDFGenerating(false);
            });
        }, 500);
    };

    // Helper for page breaks in PDF and theme enforcement
    const PageBreak = () => isPDFGenerating ? <div className="html2pdf__page-break" style={{ pageBreakBefore: 'always', height: '1px' }} /> : null;

    useEffect(() => {
        if (isPDFGenerating) {
            // Force light mode styles during PDF generation
            document.body.classList.add('pdf-mode');
        } else {
            document.body.classList.remove('pdf-mode');
        }
        return () => document.body.classList.remove('pdf-mode');
    }, [isPDFGenerating]);

    // Helper to get consolidated mitigation steps based on ALL breaches
    const getConsolidatedMitigation = (breaches) => {
        if (!breaches || breaches.length === 0) return [];

        const steps = [];
        const allRisks = breaches.map(b => b.PasswordRisk);
        const allData = breaches.flatMap(b => (b.DataClasses || []).map(d => d.toLowerCase()));

        // Password mitigation
        if (allRisks.some(r => ['plaintext', 'easytocrack'].includes(r)) || allData.includes('passwords')) {
            steps.push({ icon: Lock, title: "Secure Your Passwords", text: "At least one breach exposed passwords. Change your passwords immediately, especially if reused. Use a unique password manager." });
            steps.push({ icon: CheckCircle2, title: "Enable 2FA", text: "Turn on Two-Factor Authentication (2FA) for your email, banking, and social media accounts." });
        }

        // Financial mitigation
        if (allData.some(d => d.includes('credit') || d.includes('card') || d.includes('bank') || d.includes('payment'))) {
            steps.push({ icon: AlertTriangle, title: "Protect Financials", text: "Monitor bank statements closely. consider freezing your credit reports with Equifax, Experian, and TransUnion." });
        }

        // Identity mitigation
        if (allData.some(d => d.includes('ssn') || d.includes('social'))) {
            steps.push({ icon: User, title: "Identity Theft Protection", text: "Your SSN or identity info was exposed. Consider signing up for an identity theft monitoring service." });
        }

        // General 
        if (steps.length === 0) {
            steps.push({ icon: Shield, title: "General Hygiene", text: "Regularly check for new breaches and be cautious of phishing emails from affected services." });
        }

        return steps;
    };

    const tabs = [
        { id: 'summary', label: 'Summary', icon: Eye },
        { id: 'web', label: 'Web Presence', icon: Globe },
        { id: 'news', label: 'News & Media', icon: Newspaper },
        { id: 'social', label: 'Social Media', icon: Users },
        { id: 'professional', label: 'Professional', icon: Briefcase },
        { id: 'breaches', label: 'Data Breaches', icon: Lock },
        { id: 'privacy', label: 'Privacy Assessment', icon: Shield },
        { id: 'recommendations', label: 'Action Items', icon: CheckCircle2 }
    ];

    return (
        <div className="max-w-6xl mx-auto px-6 py-12 min-h-screen">
            <SEO title="Find Me: Digital Footprint | AimLow" description="Discover your digital footprint and learn how to protect your privacy." />

            {/* Header */}
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 border border-indigo-500/20">
                    <Shield size={14} /> Privacy Tool
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
                    Find Me: <span className="text-primary">Digital Footprint</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Discover what information about you is publicly available online and learn how to protect your privacy.
                </p>
            </div>

            {/* Input Form */}
            {step === steps.INPUT && (
                <Card className="max-w-2xl mx-auto p-8 shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Full Name *</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="e.g. John Smith"
                                required
                                className="text-lg"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Location (Optional)</label>
                                <Input
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    placeholder="e.g. New York, NY"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2">Profession (Optional)</label>
                                <Input
                                    name="profession"
                                    value={formData.profession}
                                    onChange={handleInputChange}
                                    placeholder="e.g. Software Engineer"
                                />
                            </div>
                        </div>

                        {/* Email for breach check */}
                        <div>
                            <label className="block text-sm font-semibold mb-2">
                                Email Address (Optional)
                                <span className="font-normal text-muted-foreground ml-2">— for data breach check</span>
                            </label>
                            <Input
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="e.g. john.smith@email.com"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                🔒 We'll check if this email appears in known data breaches. Your email is not stored.
                            </p>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                                <strong>💡 Tip:</strong> Adding location and profession helps narrow results and improves accuracy, especially for common names.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-2">Age Range (Optional)</label>
                            <select
                                name="ageRange"
                                value={formData.ageRange}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            >
                                <option value="">Select age range</option>
                                <option value="18-25">18-25</option>
                                <option value="26-35">26-35</option>
                                <option value="36-45">36-45</option>
                                <option value="46-55">46-55</option>
                                <option value="56+">56+</option>
                            </select>
                        </div>

                        <div className="bg-muted/50 p-4 rounded-lg border border-border">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    className="mt-1"
                                />
                                <label htmlFor="terms" className="text-sm text-muted-foreground">
                                    <strong className="text-foreground">Privacy Notice:</strong> This tool performs real web searches of publicly available information (web pages, news, social media).
                                    No private databases or paid data broker services are accessed. Results are based on actual search findings and analyzed by AI to provide privacy recommendations.
                                    Your search query is not stored.
                                </label>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg flex items-start gap-3">
                                <AlertTriangle className="text-destructive flex-shrink-0" size={20} />
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={!formData.name.trim() || !agreedToTerms}
                            size="lg"
                            className="w-full font-bold"
                        >
                            Analyze My Digital Footprint
                        </Button>
                    </form>
                </Card>
            )}

            {/* Disambiguation Step */}
            {step === steps.DISAMBIGUATION && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <Card className="p-6 shadow-lg">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold mb-2">Multiple Matches Found</h2>
                            <p className="text-muted-foreground">
                                We found several people matching "{formData.name}". Please select the correct person to analyze:
                            </p>
                        </div>

                        <div className="space-y-3">
                            {candidates.map((candidate, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleCandidateSelect(candidate)}
                                    className="w-full text-left border border-border rounded-lg p-4 hover:bg-muted/50 hover:border-primary transition-all group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                                                {candidate.name}
                                            </h3>
                                            <div className="mt-2 space-y-1">
                                                {candidate.title && candidate.title !== 'null' && (
                                                    <p className="text-sm text-muted-foreground">
                                                        <strong>Title:</strong> {candidate.title}
                                                    </p>
                                                )}
                                                {candidate.company && candidate.company !== 'null' && (
                                                    <p className="text-sm text-muted-foreground">
                                                        <strong>Company:</strong> {candidate.company}
                                                    </p>
                                                )}
                                                {candidate.location && candidate.location !== 'null' && (
                                                    <p className="text-sm text-muted-foreground">
                                                        <strong>Location:</strong> {candidate.location}
                                                    </p>
                                                )}
                                                {candidate.snippet && candidate.snippet !== 'null' && (
                                                    <p className="text-xs text-muted-foreground mt-2 italic">
                                                        "{candidate.snippet}"
                                                    </p>
                                                )}
                                                {candidate.source && candidate.source !== 'null' && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        Source: {candidate.source}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Icon name="chevron-right" size={20} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-4" />
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="mt-6 pt-6 border-t border-border">
                            <div className="flex gap-3">
                                <Button onClick={resetForm} variant="outline" className="flex-1">
                                    <Icon name="arrow-left" size={16} className="mr-2" /> Start Over
                                </Button>
                                <Button onClick={skipDisambiguation} variant="outline" className="flex-1">
                                    None of these match - Continue anyway
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Loading State with Progress Indicator */}
            {step === steps.LOADING && (
                <Card className="max-w-2xl mx-auto p-8 shadow-lg">
                    <div className="text-center mb-8">
                        <Icon name="loader" className="animate-spin mx-auto mb-4 text-primary" size={48} />
                        <h2 className="text-2xl font-bold mb-2">Analyzing Your Digital Footprint</h2>
                        <p className="text-muted-foreground">
                            {progressStages.find(s => s.id === loadingStage)?.label || 'Initializing search...'}
                        </p>
                    </div>

                    {/* Progress Steps */}
                    <div className="space-y-3">
                        {progressStages.map((stage, idx) => {
                            const currentIdx = progressStages.findIndex(s => s.id === loadingStage);
                            const isComplete = idx < currentIdx;
                            const isCurrent = stage.id === loadingStage;
                            const isPending = idx > currentIdx;

                            return (
                                <div
                                    key={stage.id}
                                    className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-300 ${isCurrent ? 'bg-primary/10 border border-primary/30' :
                                        isComplete ? 'bg-green-500/10' : 'bg-muted/30'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${isCurrent ? 'bg-primary text-white animate-pulse' :
                                        isComplete ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {isComplete ? '✓' : stage.icon}
                                    </div>
                                    <span className={`font-medium ${isCurrent ? 'text-primary' :
                                        isComplete ? 'text-green-600' : 'text-muted-foreground'
                                        }`}>
                                        {stage.label}
                                    </span>
                                    {isCurrent && (
                                        <Icon name="loader" className="ml-auto animate-spin text-primary" size={16} />
                                    )}
                                    {isComplete && (
                                        <CheckCircle2 className="ml-auto text-green-500" size={16} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-xs text-muted-foreground text-center mt-6">
                        This may take 15-30 seconds due to rate limiting between searches.
                    </p>
                </Card>
            )}

            {/* Report View */}
            {step === steps.REPORT && report && (
                <div className="space-y-6" id="find-me-report">
                    {/* PDF-specific styles - Enforce Light Mode & Print Layout */}
                    {isPDFGenerating && (
                        <style>{`
                            .page-break { page-break-before: always; }
                            .avoid-break { page-break-inside: avoid; }
                            .breach-card { page-break-inside: avoid; border: 1px solid #e2e8f0; }
                            
                            /* Enforce Light Mode - Stronger Selectors */
                            body.pdf-mode, 
                            body.pdf-mode #root, 
                            body.pdf-mode #find-me-report,
                            .pdf-mode .card,
                            .pdf-mode .bg-card {
                                background-color: #ffffff !important;
                                color: #0f172a !important;
                            }
                            .pdf-mode .bg-muted, 
                            .pdf-mode .bg-muted\/50, 
                            .pdf-mode .bg-muted\/30 {
                                background-color: #f1f5f9 !important;
                                color: #0f172a !important;
                            }
                            .pdf-mode .text-muted-foreground {
                                color: #64748b !important;
                            }
                            .pdf-mode .border, .pdf-mode .border-border {
                                border-color: #e2e8f0 !important;
                            }
                            .pdf-mode .dark\:bg-blue-900\/10 {
                                background-color: #eff6ff !important; /* blue-50 */
                            }
                            .pdf-mode .dark\:text-blue-400 {
                                color: #2563eb !important; /* blue-600 */
                            }
                            .pdf-mode .dark\:border-blue-800 {
                                border-color: #dbeafe !important; /* blue-100 */
                            }
                        `}</style>
                    )}

                    {/* Standard Header - Hidden during PDF */}
                    {!isPDFGenerating && (
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold">{report.person_name}</h2>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-sm text-muted-foreground">Digital Footprint Analysis</p>
                                    {report.match_quality && (
                                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${report.match_quality === 'High' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                                            report.match_quality === 'Medium' ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' :
                                                'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                                            }`}>
                                            {report.match_quality} Confidence
                                        </span>
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={resetForm}>
                                <Icon name="arrow-left" size={16} className="mr-2" />
                                New Search
                            </Button>
                        </div>
                    )}

                    {/* PDF-Only Header */}
                    {isPDFGenerating && (
                        <div className="mb-6 border-b pb-4">
                            <h1 className="text-3xl font-bold text-gray-900">Data Breach Report</h1>
                            <p className="text-xl text-gray-600">Prepared for: {report.person_name}</p>
                            <p className="text-sm text-gray-500 mt-1">Generated by AimLow Find Me</p>
                        </div>
                    )}
                    {/* Tabs */}
                    {/* Tab Content */}
                    <Card className={`p-6 shadow-lg ${isPDFGenerating ? 'shadow-none border-0 p-0' : ''}`}>
                        {activeTab === 'summary' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Eye size={20} /> Executive Summary
                                    </h3>
                                    <ul className="space-y-2">
                                        {report.executive_summary?.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <CheckCircle2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {activeTab === 'web' && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Globe size={20} /> Web Presence
                                </h3>
                                <div className="bg-muted/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold">Overall Visibility</span>
                                        <span className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full font-bold">
                                            {report.web_presence?.overall_visibility}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{report.web_presence?.description}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-3">Key Findings</h4>
                                    <ul className="space-y-2">
                                        {report.web_presence?.key_findings?.map((finding, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-primary mt-1">•</span>
                                                <span className="text-sm">{finding}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                {report.web_presence?.sources?.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold mb-3">Sources</h4>
                                        <div className="space-y-2">
                                            {report.web_presence.sources.map((source, idx) => (
                                                <a
                                                    key={idx}
                                                    href={source.url.startsWith('http') ? source.url : `https://${source.url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                                                >
                                                    <span className="text-sm font-medium group-hover:text-primary transition-colors">{source.title}</span>
                                                    <Icon name="external-link" size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}


                        {activeTab === 'news' && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Newspaper size={20} /> News & Media Mentions
                                </h3>
                                <div className="bg-muted/50 p-4 rounded-lg mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">Mentions Found</span>
                                        <span className="text-2xl font-bold text-primary">{report.news_media?.mentions_found}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">{report.news_media?.description}</p>
                                </div>
                                {report.news_media?.notable_mentions?.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="font-semibold">Notable Mentions</h4>
                                        {report.news_media.notable_mentions.map((mention, idx) => (
                                            <div key={idx} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-sm">{mention.source}</span>
                                                    <a
                                                        href={`https://${mention.url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline"
                                                    >
                                                        View →
                                                    </a>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{mention.context}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'social' && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Users size={20} /> Social Media Footprint
                                </h3>
                                <div className="bg-muted/50 p-4 rounded-lg mb-4">
                                    <p className="text-sm text-muted-foreground">{report.social_media?.description}</p>
                                </div>

                                {report.social_media?.profiles?.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <h4 className="font-semibold mb-3">Social Media Accounts</h4>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="border-b border-border">
                                                    <th className="text-left py-3 px-4 font-semibold text-sm">Platform</th>
                                                    <th className="text-left py-3 px-4 font-semibold text-sm">Handle/Username</th>
                                                    <th className="text-left py-3 px-4 font-semibold text-sm">Visibility</th>
                                                    <th className="text-left py-3 px-4 font-semibold text-sm">Link</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.social_media.profiles.map((profile, idx) => (
                                                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <span className="font-medium">{profile.platform}</span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="text-sm text-muted-foreground font-mono">
                                                                {profile.handle || profile.username || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`text-xs px-2 py-1 rounded-full ${profile.visibility === 'Public' ? 'bg-red-500/10 text-red-600' :
                                                                profile.visibility === 'Limited' ? 'bg-yellow-500/10 text-yellow-600' :
                                                                    'bg-green-500/10 text-green-600'
                                                                }`}>
                                                                {profile.visibility}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {profile.url ? (
                                                                <a
                                                                    href={profile.url.startsWith('http') ? profile.url : `https://${profile.url}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary hover:underline flex items-center gap-1 text-sm"
                                                                >
                                                                    View Profile <Icon name="external-link" size={12} />
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Not found</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {report.social_media.profiles.some(p => p.details) && (
                                            <div className="mt-4 space-y-2">
                                                <h5 className="font-semibold text-sm">Additional Details</h5>
                                                {report.social_media.profiles.filter(p => p.details).map((profile, idx) => (
                                                    <div key={idx} className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                                                        <strong className="text-foreground">{profile.platform}:</strong> {profile.details}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'professional' && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Briefcase size={20} /> Professional Listings
                                </h3>
                                <div className="bg-muted/50 p-4 rounded-lg mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        {report.professional_listings?.found ? (
                                            <CheckCircle2 size={18} className="text-green-600" />
                                        ) : (
                                            <XCircle size={18} className="text-muted-foreground" />
                                        )}
                                        <span className="font-semibold">
                                            {report.professional_listings?.found ? 'Listings Found' : 'No Listings Found'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{report.professional_listings?.description}</p>
                                </div>
                                {report.professional_listings?.listings?.length > 0 && (
                                    <div className="space-y-3">
                                        {report.professional_listings.listings.map((listing, idx) => (
                                            <div key={idx} className="border border-border rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold">{listing.source}</span>
                                                    {listing.url && (
                                                        <a
                                                            href={listing.url.startsWith('http') ? listing.url : `https://${listing.url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-primary hover:underline flex items-center gap-1"
                                                        >
                                                            View <Icon name="external-link" size={10} />
                                                        </a>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{listing.details}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {(activeTab === 'breaches' || isPDFGenerating) && (
                            <div className="space-y-6">
                                {/* Page Break not needed if only one section in PDF */}
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Lock size={20} /> Data Breach Check
                                </h3>

                                {report.data_breaches?.checked ? (
                                    <>
                                        <div className={`p-6 rounded-lg ${report.data_breaches.breach_count > 0
                                            ? 'bg-red-500/10 border border-red-500/20'
                                            : 'bg-green-500/10 border border-green-500/20'
                                            }`}>
                                            <div className="flex items-center gap-3 mb-3">
                                                {report.data_breaches.breach_count > 0 ? (
                                                    <AlertTriangle className="text-red-600" size={24} />
                                                ) : (
                                                    <CheckCircle2 className="text-green-600" size={24} />
                                                )}
                                                <div>
                                                    <p className="font-bold text-lg">
                                                        {report.data_breaches.breach_count > 0
                                                            ? `Found in ${report.data_breaches.breach_count} Data Breach${report.data_breaches.breach_count > 1 ? 'es' : ''}`
                                                            : 'No Data Breaches Found'}
                                                    </p>
                                                    {report.data_breaches.email_checked && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Email checked: {report.data_breaches.email_checked}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {report.data_breaches.summary && (
                                                <p className="text-sm mt-3">{report.data_breaches.summary}</p>
                                            )}
                                        </div>

                                        {/* Consolidated Mitigation Strategy */}
                                        {report.data_breaches.breaches?.length > 0 && (
                                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-lg border border-blue-100 dark:border-blue-800">
                                                <h4 className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400 mb-3">
                                                    <Shield size={18} /> Recommended Mitigation Strategy
                                                </h4>
                                                <div className="grid gap-3">
                                                    {getConsolidatedMitigation(report.data_breaches.breaches).map((step, idx) => (
                                                        <div key={idx} className="flex gap-3 items-start">
                                                            <div className="mt-1 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-sm text-blue-600">
                                                                <step.icon size={16} />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-sm">{step.title}</p>
                                                                <p className="text-sm text-muted-foreground">{step.text}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {report.data_breaches.breaches?.length > 0 && (
                                            <div className="space-y-4">
                                                <h4 className="font-semibold">
                                                    {isPDFGenerating
                                                        ? `All Data Breaches (Ranked by Risk)`
                                                        : `Top 10 Most Severe Breaches (Ranked by Risk)`}
                                                </h4>
                                                {report.data_breaches.breaches.slice(0, isPDFGenerating ? undefined : 10).map((breach, idx) => (
                                                    <div key={idx} className={`border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors ${isPDFGenerating ? 'breach-card' : ''}`}>
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-3">
                                                                {breach.logo && (
                                                                    <img src={breach.logo} alt="" className="w-8 h-8 rounded object-contain" onError={(e) => e.target.style.display = 'none'} />
                                                                )}
                                                                <div>
                                                                    <span className="font-bold text-lg">{breach.name}</span>
                                                                    {breach.domain && (
                                                                        <p className="text-xs text-muted-foreground">{breach.domain}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 flex-wrap justify-end">
                                                                {breach.password_risk && breach.password_risk !== 'unknown' && (
                                                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${breach.password_risk === 'plaintext' ? 'bg-red-600 text-white' :
                                                                        breach.password_risk === 'easytocrack' ? 'bg-red-500/20 text-red-600' :
                                                                            breach.password_risk === 'hardtocrack' ? 'bg-yellow-500/20 text-yellow-600' :
                                                                                'bg-blue-500/10 text-blue-600'
                                                                        }`}>
                                                                        {breach.password_risk === 'plaintext' ? '⚠️ PLAINTEXT' :
                                                                            breach.password_risk === 'easytocrack' ? '⚠️ Easy to Crack' :
                                                                                breach.password_risk === 'hardtocrack' ? '🔒 Hard to Crack' :
                                                                                    breach.password_risk}
                                                                    </span>
                                                                )}
                                                                {breach.industry && (
                                                                    <span className="text-xs px-2 py-1 bg-muted rounded-full">
                                                                        {breach.industry}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                                            <div>
                                                                <span className="text-muted-foreground">Date: </span>
                                                                <span>{breach.date || 'Unknown'}</span>
                                                            </div>
                                                            {breach.records_affected > 0 && (
                                                                <div>
                                                                    <span className="text-muted-foreground">Records: </span>
                                                                    <span className="font-semibold text-red-600">{Number(breach.records_affected).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {breach.description && (
                                                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                                {breach.description}
                                                            </p>
                                                        )}

                                                        {breach.data_exposed?.length > 0 && (
                                                            <div>
                                                                <span className="text-xs text-muted-foreground mb-1 block">Data Exposed:</span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {breach.data_exposed.map((data, i) => (
                                                                        <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${data.toLowerCase().includes('password') ? 'bg-red-500/20 text-red-600 font-semibold' :
                                                                            data.toLowerCase().includes('email') ? 'bg-orange-500/20 text-orange-600' :
                                                                                'bg-muted'
                                                                            }`}>
                                                                            {data}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}


                                                    </div>
                                                ))}
                                                {!isPDFGenerating && report.data_breaches.breaches.length > 10 && (
                                                    <div className="bg-muted/30 p-4 rounded-lg text-center">
                                                        <p className="text-sm text-muted-foreground">
                                                            Showing top 10 most severe breaches. <strong>{report.data_breaches.breaches.length - 10} additional breaches</strong> will be included in the full export.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="bg-muted/50 p-6 rounded-lg text-center">
                                        <Lock className="mx-auto mb-4 text-muted-foreground" size={40} />
                                        <p className="font-semibold mb-2">No Email Provided</p>
                                        <p className="text-sm text-muted-foreground">
                                            To check for data breaches, enter your email address in the search form.
                                            We use XposedOrNot to check if your email appears in known data breaches.
                                        </p>
                                    </div>
                                )}

                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                                    <p className="text-sm text-blue-600 dark:text-blue-400">
                                        <strong>🔒 Privacy Note:</strong> Breach checks are powered by{' '}
                                        <a href="https://xposedornot.com" target="_blank" rel="noopener noreferrer" className="underline">
                                            XposedOrNot
                                        </a>. Your email is only used for this check and is not stored.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'privacy' && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Shield size={20} /> Privacy Assessment
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-muted/50 p-6 rounded-lg">
                                        <RiskBadge level={report.privacy_assessment?.risk_level} />
                                        <div className="mt-4">
                                            <RiskScore score={report.privacy_assessment?.risk_score || 5} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                                            <AlertTriangle size={18} /> Vulnerabilities
                                        </h4>
                                        <ul className="space-y-2">
                                            {report.privacy_assessment?.vulnerabilities?.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm">
                                                    <XCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
                                            <CheckCircle2 size={18} /> Positive Factors
                                        </h4>
                                        <ul className="space-y-2">
                                            {report.privacy_assessment?.positive_factors?.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm">
                                                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'recommendations' && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <CheckCircle2 size={20} /> Recommended Actions
                                </h3>

                                <div className="space-y-4">
                                    {report.recommendations?.map((rec, idx) => (
                                        <div key={idx} className="border border-border rounded-lg p-5 hover:bg-muted/50 transition-colors">
                                            <div className="flex items-start justify-between mb-3">
                                                <h4 className="font-bold text-lg">{rec.action}</h4>
                                                <span className={`text-xs px-2 py-1 rounded-full font-bold ${rec.priority === 'High' ? 'bg-red-500/10 text-red-600' :
                                                    rec.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-600' :
                                                        'bg-blue-500/10 text-blue-600'
                                                    }`}>
                                                    {rec.priority} Priority
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-3">{rec.reason}</p>
                                            <div className="bg-muted/50 p-3 rounded-lg">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase">How To:</span>
                                                <p className="text-sm mt-1">{rec.how_to}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {report.data_removal_resources?.length > 0 && (
                                    <div className="mt-8">
                                        <h4 className="font-semibold mb-4">Data Removal Resources</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {report.data_removal_resources.map((resource, idx) => (
                                                <a
                                                    key={idx}
                                                    href={`https://${resource.url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors block"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-semibold text-sm">{resource.service}</span>
                                                        <Icon name="external-link" size={14} className="text-primary" />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{resource.purpose}</p>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* PDF Export Section */}
                    <div className="mt-8 border-t border-border pt-8" data-html2canvas-ignore="true">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div>
                                <h3 className="text-xl font-bold mb-2">Export Full Report</h3>
                                <p className="text-muted-foreground max-w-xl">
                                    Download a professional PDF report containing all 40+ checks, including the full list of data breaches, detailed privacy assessment, and step-by-step removal guides.
                                </p>
                            </div>

                            {hasBetaAccess ? (
                                <Button
                                    onClick={handleDownloadPDF}
                                    disabled={isPDFGenerating}
                                    size="lg"
                                    className="gap-2 min-w-[200px]"
                                >
                                    {isPDFGenerating ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                                    Download PDF Report
                                </Button>
                            ) : (
                                <Card className="p-6 bg-muted/30 border-dashed border-primary/20 w-full md:w-auto min-w-[350px]">
                                    <div className="flex items-center gap-2 mb-4 text-primary">
                                        <Lock size={18} />
                                        <span className="font-bold text-sm uppercase tracking-wider">Premium Feature</span>
                                    </div>
                                    <h4 className="font-bold mb-2">Unlock Full PDF Report</h4>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Join our Beta Program for free to unlock file exports and unlimited searches.
                                    </p>
                                    <form onSubmit={handleBetaSignup} className="flex gap-2">
                                        <Input
                                            placeholder="Enter your email"
                                            value={betaEmail}
                                            onChange={(e) => setBetaEmail(e.target.value)}
                                            required
                                            type="email"
                                            className="bg-background"
                                        />
                                        <Button type="submit" disabled={betaSignupStatus === 'loading'}>
                                            {betaSignupStatus === 'loading' ? <Loader2 className="animate-spin" /> : 'Join'}
                                        </Button>
                                    </form>
                                    {betaSignupStatus === 'success' && (
                                        <p className="text-green-600 text-xs mt-2 font-medium flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Unlocked! You can now download.
                                        </p>
                                    )}
                                </Card>
                            )}
                        </div>
                    </div>
                </div >
            )
            }

            {/* PDF Generation Overlay */}
            {
                isPDFGenerating && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-foreground">
                        <div className="bg-card p-8 rounded-xl shadow-lg border border-border flex flex-col items-center">
                            <Loader2 size={40} className="animate-spin mb-4 text-primary" />
                            <h2 className="text-xl font-bold mb-2">Generating Report...</h2>
                            <p className="text-muted-foreground text-sm">Compiling all results into PDF format.</p>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default FindMe;
