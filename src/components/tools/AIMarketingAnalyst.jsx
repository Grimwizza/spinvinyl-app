
import React, { useState, useEffect } from 'react';
import { SEO } from '../../seo-tools/SEOTags';
import { Icon } from '../ui/Icon';
import { ChevronDown, Printer, Mail, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { ReportView } from './ai-marketing-analyst/ReportView';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

const SkeletonLoader = () => (
    <Card className="h-[600px] flex flex-col p-0 overflow-hidden border-border bg-card animate-pulse">
        <div className="h-48 bg-muted border-b border-border p-8">
            <div className="h-10 w-2/3 bg-muted-foreground/20 mb-4 rounded-md"></div>
            <div className="h-5 w-1/3 bg-muted-foreground/20 rounded-md"></div>
        </div>
        <div className="p-8 space-y-4">
            <div className="h-4 bg-muted-foreground/10 rounded w-full"></div>
            <div className="h-4 bg-muted-foreground/10 rounded w-5/6"></div>
            <div className="h-4 bg-muted-foreground/10 rounded w-4/6"></div>
            <div className="h-4 bg-muted-foreground/10 rounded w-full"></div>
        </div>
    </Card>
);

export const AIMarketingAnalyst = ({ onBack }) => {
    const [inputBrand, setInputBrand] = useState('');
    const [country, setCountry] = useState('United States');
    const [reports, setReports] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [email, setEmail] = useState('');
    const [signupStatus, setSignupStatus] = useState('idle');
    const [isPDFGenerating, setIsPDFGenerating] = useState(false);

    useEffect(() => {
        const access = localStorage.getItem('aimlow_beta_access');
        const storedEmail = localStorage.getItem('aimlow_beta_email');
        if (access === 'granted') setHasAccess(true);
        if (storedEmail) setEmail(storedEmail);
    }, []);

    const [error, setError] = useState(null);

    const runAnalysis = async (brandName, contextBrand = null) => {
        if (!brandName) return;
        setIsGenerating(true);
        setError(null);
        setReports([]); // Clear previous results

        // 70s Client-Side Timeout (slightly longer than server's 60s to allow for network latency)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 70000);

        try {
            const payload = { brand: brandName, context: contextBrand, country: country };

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'deep-dive', payload }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let data;
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("JSON Parse Error:", text);
                throw new Error(`Server Error: Received Invalid JSON. (Response likely HTML or empty).Preview: ${text.substring(0, 50)}...`);
            }

            if (!response.ok || data.error) throw new Error(data.error || "Server Error");

            if (data.result) {
                const reportData = data.result;

                setReports([{
                    id: Date.now(),
                    brand: brandName,
                    data: reportData, // Store the structured JSON directly
                    country
                }]);
            }
        } catch (err) {
            console.error(err);
            let errorMessage = err.message;
            if (err.name === 'AbortError') {
                errorMessage = "Network Timeout: The report took too long to generate (over 70s). Please try again with a better connection.";
            }
            setError(errorMessage);
        } finally {
            setIsGenerating(false);
            clearTimeout(timeoutId);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        runAnalysis(inputBrand);
        setInputBrand('');
    };

    const handleBetaSignup = async (e) => {
        e.preventDefault();
        setSignupStatus('loading');
        try {
            await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            localStorage.setItem('aimlow_beta_access', 'granted');
            localStorage.setItem('aimlow_beta_email', email);
            setHasAccess(true);
            setSignupStatus('success');
        } catch (error) {
            setSignupStatus('error');
            setTimeout(() => setSignupStatus('idle'), 3000);
        }
    };

    const handleDownloadPDF = () => {
        setIsPDFGenerating(true);
        // Wait for render to update styles (force show all tabs)
        setTimeout(() => {
            const report = reports[reports.length - 1];
            if (!report) {
                setIsPDFGenerating(false);
                return;
            }
            const element = document.getElementById(`report-view-${report.id}`);
            if (!element) {
                setIsPDFGenerating(false);
                return;
            }

            const opt = {
                margin: 0.25, // Increased margin slightly
                filename: `${report.brand}_Deep_Dive_Report.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'] }
            };

            html2pdf().set(opt).from(element).save().then(() => {
                setIsPDFGenerating(false);
            });
        }, 500); // 500ms delay to ensure DOM update and chart rendering
    };

    const handleEmailReport = async () => {
        if (!email) {
            alert("Please Unlock Pro Access first to enable email reports.");
            return;
        }

        const reportToSend = reports[reports.length - 1]; // Send the most recent report
        if (!reportToSend) return;

        const button = document.activeElement;
        if (button) button.disabled = true;
        const originalText = button ? button.innerText : "";
        if (button) button.innerText = "SENDING...";

        try {
            const response = await fetch('/api/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, report: reportToSend.data })
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Report successfully sent to ${email} `);
            } else {
                throw new Error(result.error || "Failed to send");
            }
        } catch (err) {
            console.error(err);
            alert("Error sending email: " + err.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerText = originalText || "EMAIL REPORT";
            }
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const removeReport = (id) => {
        setReports(reports.filter(r => r.id !== id));
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <SEO title="AI Marketing Analyst" description="BETA AI Marketing Analyst. 4P & SWOT Reports." />
            <div className="print:hidden">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        <Icon name="arrow-left" size={18} /> Back to Lab
                    </button>
                </div>

                <div className="mb-12 text-center max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 border border-primary/20">
                        <Icon name="sparkles" size={14} /> BETA Free
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">AI Marketing Analyst</h1>
                    <p className="text-xl text-muted-foreground">Instant strategic audits. Enter a brand to starting mining.</p>
                </div>

                <Card className="p-2 mb-12 max-w-4xl mx-auto shadow-lg border-border/60 bg-card/50 backdrop-blur-sm">
                    <form onSubmit={handleFormSubmit} className="flex flex-col md:flex-row gap-2">
                        {/* COUNTRY DROPDOWN */}
                        <div className="relative min-w-[200px] group">
                            <label className="absolute top-2 left-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pointer-events-none z-10">Target Market</label>
                            <select
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                className="w-full h-full appearance-none bg-muted/30 border border-transparent rounded-lg pl-4 pr-10 pt-6 pb-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-muted/50 transition-colors cursor-pointer text-foreground"
                            >
                                <option value="Global">Global</option>
                                <option value="United States">USA</option>
                                <option value="United Kingdom">UK</option>
                                <option value="Canada">Canada</option>
                                <option value="Europe">Europe</option>
                                <option value="Asia">Asia</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <ChevronDown size={16} strokeWidth={2.5} />
                            </div>
                        </div>

                        <div className="flex-grow">
                            <Input
                                value={inputBrand}
                                onChange={(e) => setInputBrand(e.target.value)}
                                className="h-full text-lg font-medium px-4 py-3 bg-muted/30 border-transparent focus:border-primary/30 focus:bg-background transition-all"
                                placeholder="Enter Brand (e.g. Nike)..."
                                name="brand"
                                autoComplete="off"
                            />
                        </div>

                        <Button type="submit" disabled={isGenerating || !inputBrand} size="lg" className="px-8 font-bold text-base h-auto py-3 shadow-md">
                            {isGenerating ? <div className="flex items-center gap-2"><Icon name="loader" className="animate-spin" /> Analyzing...</div> : "Analyze"}
                        </Button>
                    </form>
                </Card>
            </div>

            {reports.length > 0 && (
                <div className="flex justify-end gap-3 mb-8 print:hidden flex-wrap">
                    <Button disabled={isPDFGenerating} onClick={handleDownloadPDF} variant="outline" className="gap-2">
                        {isPDFGenerating ? <Icon name="loader" className="animate-spin" size={16} /> : <Download size={16} />} Download PDF
                    </Button>
                    <Button onClick={handleEmailReport} variant="outline" className="gap-2">
                        <Mail size={16} /> Email Report
                    </Button>
                    <Button onClick={handlePrint} variant="outline" className="gap-2">
                        <Printer size={16} /> Print Report
                    </Button>
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-6 mb-12 flex items-start gap-4 rounded-lg">
                    <Icon name="alert-triangle" className="text-destructive flex-shrink-0" size={24} />
                    <div>
                        <h3 className="font-bold text-lg text-destructive mb-1">Analysis Failed</h3>
                        <p className="text-muted-foreground">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-12">
                {reports.map((report) => (
                    <ReportView
                        key={report.id}
                        report={report}
                        hasAccess={hasAccess}
                        runAnalysis={runAnalysis}
                        removeReport={removeReport}
                        handleBetaSignup={handleBetaSignup}
                        email={email}
                        setEmail={setEmail}
                        signupStatus={signupStatus}
                        forceShowAll={isPDFGenerating}
                    />
                ))}
                {isGenerating && <SkeletonLoader />}
            </div>

            {/* Overlay for PDF Generation State */}
            {isPDFGenerating && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-foreground print:hidden">
                    <div className="bg-card p-8 rounded-xl shadow-lg border border-border flex flex-col items-center">
                        <Icon name="loader" size={40} className="animate-spin mb-4 text-primary" />
                        <h2 className="text-xl font-bold mb-2">Generating PDF...</h2>
                        <p className="text-muted-foreground text-sm">Please wait while we capture the report.</p>
                    </div>
                </div>
            )}

        </div>
    );
};