import React, { useState } from 'react';
import { ExternalLink, Lock, TrendingUp, DollarSign, Globe, Shield, Target, Users, Zap, AlertTriangle, Layers, BarChart3, PieChart } from 'lucide-react';
import { Icon } from '../../ui/Icon';
import { SalesChart } from './Charts';
import { TradingViewWidget } from './TradingViewWidget';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

const StatCard = ({ label, value, icon, link, className = "" }) => (
    <Card className={`p-4 flex flex-col justify-between hover:shadow-md transition-shadow break-inside-avoid ${className}`}>
        <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
            {icon}
        </div>
        <div className="font-bold text-xl md:text-2xl break-words tracking-tight text-foreground">
            {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1 transition-colors">
                    {value} <ExternalLink size={14} />
                </a>
            ) : value}
        </div>
    </Card>
);

const SectionHeader = ({ title, icon }) => (
    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-border pb-2 tracking-tight">
        {React.cloneElement(icon, { size: 20, className: "text-primary" })} {title}
    </h3>
);

const BulletList = ({ items }) => (
    <ul className="space-y-3">
        {items?.map((item, i) => (
            <li key={i} className="flex gap-3 items-start p-4 bg-muted/20 border-l-[3px] border-primary rounded-r-md hover:bg-muted/40 transition-colors">
                <Icon name="chevron-right" size={16} className="mt-1 flex-shrink-0 text-primary" />
                <span className="text-base leading-relaxed text-foreground/90">{item}</span>
            </li>
        ))}
    </ul>
);

export const ReportView = ({ report, hasAccess, removeReport, handleBetaSignup, email, setEmail, signupStatus, forceShowAll }) => {
    const d = report.data;
    const [activeTab, setActiveTab] = useState('overview');

    if (!d) return <div className="p-8 text-center text-destructive font-bold">Error: Invalid Report Data</div>;

    const analysisDate = new Date(report.id).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    // Transform quarterly data
    const salesChartData = (d.financials?.quarterly_revenue_data?.map(s => ({
        name: s.period,
        revenue: s.revenue,
        unit: s.unit,
        growth: s.growth_yoy
    })) || []).sort((a, b) => {
        const [qA, yA] = a.name.split(' ');
        const [qB, yB] = b.name.split(' ');
        if (yA !== yB) return parseInt(yA) - parseInt(yB);
        return parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', ''));
    });

    const isFinancialsAvailable = d.financials?.revenue_latest !== "Data Unavailable" && d.financials?.revenue_latest !== "Private Company";

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <Layers size={16} /> },
        { id: 'marketing', label: 'Marketing 4Ps', icon: <Target size={16} /> },
        { id: 'swot', label: 'SWOT', icon: <Shield size={16} /> },
        { id: 'financials', label: 'Financials', icon: <DollarSign size={16} /> },
        { id: 'sources', label: 'Sources', icon: <ExternalLink size={16} /> },
    ];

    return (
        <div id={`report-view-${report.id}`} className={`relative bg-card border border-border p-0 shadow-sm rounded-xl overflow-hidden animate-in fade-in duration-500 ${forceShowAll ? '!block h-auto' : 'flex flex-col h-full'} print:block print:shadow-none print:border-0`}>

            {/* --- HEADER --- */}
            <div className="bg-primary/5 border-b border-border p-6 md:p-8 flex justify-between items-start print:bg-white print:text-black print:border-b-2">
                <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border border-primary/20">REPORT #{report.id.toString().slice(-4)}</span>
                        <span className="text-muted-foreground text-xs uppercase font-medium">{analysisDate}</span>
                    </div>
                    <div className="flex items-baseline gap-4 flex-wrap mb-2">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">{d.brand_name}</h2>
                        {d.ticker && d.ticker !== 'Private' && <span className="font-mono text-lg text-muted-foreground bg-muted px-2 py-0.5 rounded">{d.ticker}</span>}
                    </div>
                    <p className="text-lg text-muted-foreground max-w-2xl">{d.parent_company ? `Subsidiary of ${d.parent_company}` : `Market: ${report.country}`}</p>
                </div>
                <div className="flex flex-col items-end gap-5">
                    <button onClick={() => removeReport(report.id)} className={`text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-full transition-colors print:hidden ${forceShowAll ? 'hidden' : ''}`}>
                        <Icon name="x" size={20} />
                    </button>
                    <div className="flex items-center gap-3 opacity-90">
                        <div className="text-right hidden md:block">
                            <div className="font-bold text-sm leading-none tracking-tight">AIMLOW.AI</div>
                            <div className="text-[10px] text-primary uppercase tracking-widest font-semibold mt-0.5">Pro Analyst</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- TABS --- */}
            <div className={`flex overflow-x-auto border-b border-border bg-muted/30 print:hidden sticky top-0 z-20 no-scrollbar ${forceShowAll ? 'hidden' : ''}`}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-4 font-semibold text-sm tracking-wide flex items-center gap-2 border-r border-border/50 transition-all whitespace-nowrap relative
                            ${activeTab === tab.id
                                ? 'bg-card text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="p-6 md:p-10 min-h-[500px] overflow-y-auto">

                {/* TAB: OVERVIEW */}
                <div className={activeTab === 'overview' || forceShowAll ? 'block' : 'hidden print:block'}>
                    <div className="space-y-10 animate-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <SectionHeader title="Executive Summary" icon={<Zap />} />
                            <BulletList items={d.executive_summary} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div>
                                <SectionHeader title="Target Persona" icon={<Users />} />
                                <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 p-6 space-y-5">
                                    <div>
                                        <h4 className="font-bold uppercase text-xs text-blue-600 dark:text-blue-400 mb-1 tracking-wider">Demographics</h4>
                                        <p className="text-base leading-relaxed">{d.target_persona?.demographics}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold uppercase text-xs text-blue-600 dark:text-blue-400 mb-1 tracking-wider">Psychographics</h4>
                                        <p className="text-base leading-relaxed">{d.target_persona?.psychographics}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold uppercase text-xs text-blue-600 dark:text-blue-400 mb-1 tracking-wider">Job to be Done</h4>
                                        <p className="italic text-base opacity-90">"{d.target_persona?.job_to_be_done}"</p>
                                    </div>
                                </Card>
                            </div>

                            <div>
                                <SectionHeader title="Core Competitors" icon={<Target />} />
                                <div className="grid gap-4">
                                    {d.competitors?.map((comp, i) => (
                                        <Card key={i} className="p-4 border-border/60 bg-muted/10">
                                            <h4 className="font-bold uppercase text-sm mb-1 text-primary">{comp.name}</h4>
                                            <p className="text-base text-muted-foreground">{comp.differentiator}</p>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TAB: MARKETING 4PS */}
                <div className={`${activeTab === 'marketing' || forceShowAll ? 'block' : 'hidden print:block'} print:break-before-page`} style={forceShowAll ? { breakBefore: 'page', pageBreakBefore: 'always' } : {}}>
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        {!hasAccess ? <LockedState email={email} setEmail={setEmail} handleBetaSignup={handleBetaSignup} signupStatus={signupStatus} /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900 p-6">
                                    <h4 className="border-b border-orange-200 dark:border-orange-800 pb-2 mb-4 font-bold uppercase text-orange-700 dark:text-orange-400">Product</h4>
                                    <p className="text-base leading-relaxed">{d.marketing_4ps?.product}</p>
                                </Card>
                                <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900 p-6">
                                    <h4 className="border-b border-green-200 dark:border-green-800 pb-2 mb-4 font-bold uppercase text-green-700 dark:text-green-400">Price</h4>
                                    <p className="text-base leading-relaxed">{d.marketing_4ps?.price}</p>
                                </Card>
                                <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 p-6">
                                    <h4 className="border-b border-blue-200 dark:border-blue-800 pb-2 mb-4 font-bold uppercase text-blue-700 dark:text-blue-400">Place</h4>
                                    <p className="text-base leading-relaxed">{d.marketing_4ps?.place}</p>
                                </Card>
                                <Card className="bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900 p-6">
                                    <h4 className="border-b border-red-200 dark:border-red-800 pb-2 mb-4 font-bold uppercase text-red-700 dark:text-red-400">Promotion</h4>
                                    <p className="text-base leading-relaxed">{d.marketing_4ps?.promotion}</p>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>

                {/* TAB: SWOT */}
                <div className={`${activeTab === 'swot' || forceShowAll ? 'block' : 'hidden print:block'} print:break-before-page`} style={forceShowAll ? { breakBefore: 'page', pageBreakBefore: 'always' } : {}}>
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        {!hasAccess ? <LockedState email={email} setEmail={setEmail} handleBetaSignup={handleBetaSignup} signupStatus={signupStatus} /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="flex items-center gap-2 font-bold uppercase text-green-700 dark:text-green-400 bg-green-100/50 dark:bg-green-900/30 p-3 rounded mb-3 text-sm tracking-wide"><Icon name="arrow-up" size={16} /> Strengths</h4>
                                    <ul className="list-disc pl-5 space-y-2 text-base text-muted-foreground">
                                        {d.swot?.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="flex items-center gap-2 font-bold uppercase text-red-700 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30 p-3 rounded mb-3 text-sm tracking-wide"><Icon name="arrow-down" size={16} /> Weaknesses</h4>
                                    <ul className="list-disc pl-5 space-y-2 text-base text-muted-foreground">
                                        {d.swot?.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="flex items-center gap-2 font-bold uppercase text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 p-3 rounded mb-3 text-sm tracking-wide"><Icon name="zap" size={16} /> Opportunities</h4>
                                    <ul className="list-disc pl-5 space-y-2 text-base text-muted-foreground">
                                        {d.swot?.opportunities.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="flex items-center gap-2 font-bold uppercase text-orange-700 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-900/30 p-3 rounded mb-3 text-sm tracking-wide"><Icon name="alert-triangle" size={16} /> Threats</h4>
                                    <ul className="list-disc pl-5 space-y-2 text-base text-muted-foreground">
                                        {d.swot?.threats.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* TAB: FINANCIALS */}
                <div className={`${activeTab === 'financials' || forceShowAll ? 'block' : 'hidden print:block'} print:break-before-page`} style={forceShowAll ? { breakBefore: 'page', pageBreakBefore: 'always' } : {}}>
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        {!hasAccess ? <LockedState email={email} setEmail={setEmail} handleBetaSignup={handleBetaSignup} signupStatus={signupStatus} /> : (
                            <>
                                {d.financials?.financial_note && (
                                    <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 border-l-4 border-yellow-500 mb-8 flex gap-3 text-sm font-medium text-yellow-800 dark:text-yellow-200 rounded-r">
                                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                        <span>NOTE: {d.financials.financial_note}</span>
                                    </div>
                                )}

                                {!isFinancialsAvailable && (
                                    <div className="p-12 mb-8 bg-muted/20 border border-dashed border-border rounded-xl text-center font-medium text-muted-foreground">
                                        Limited financial data available for this entity.
                                    </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 break-inside-avoid">
                                    <StatCard label="Market Cap" value={d.financials?.market_cap} icon={<DollarSign size={16} className="text-muted-foreground" />} />
                                    <StatCard label="Revenue (Latest)" value={d.financials?.revenue_latest} icon={<TrendingUp size={16} className="text-muted-foreground" />} />
                                    <StatCard label="P/E Ratio" value={d.financials?.pe_ratio} icon={<BarChart3 size={16} className="text-muted-foreground" />} />
                                    <StatCard label="Currency" value={d.financials?.currency} icon={<Globe size={16} className="text-muted-foreground" />} />
                                </div>

                                {d.ticker && d.ticker !== 'Private' && (
                                    <TradingViewWidget ticker={d.ticker} />
                                )}

                                {salesChartData.length > 0 && (
                                    <SalesChart
                                        data={salesChartData}
                                        title="Reported Quarterly Revenue"
                                        unit={salesChartData[0]?.unit || 'B'}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* TAB: SOURCES */}
                <div className={`${activeTab === 'sources' || forceShowAll ? 'block' : 'hidden print:block'} print:break-before-page`} style={forceShowAll ? { breakBefore: 'page', pageBreakBefore: 'always' } : {}}>
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        <SectionHeader title="Data Sources" icon={<ExternalLink />} />
                        <ul className="space-y-3">
                            {d.sources?.map((source, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer transition-colors bg-muted/30 p-2 rounded border border-transparent hover:border-border">
                                    <ExternalLink size={14} />
                                    {source}
                                </li>
                            ))}
                            {(!d.sources || d.sources.length === 0) && <li className="text-muted-foreground italic">No specific sources cited.</li>}
                        </ul>
                    </div>
                </div>

            </div>
            {/* PRINT FOOTER */}
            <div className="hidden print:flex justify-between items-center border-t border-gray-300 mt-8 pt-4">
                <span className="font-mono text-xs text-gray-400">Generated by AimLow.ai • Pro Analyst</span>
                <span className="font-bold text-xl text-gray-600">AL.</span>
            </div>
        </div>
    );
};

const LockedState = ({ email, setEmail, handleBetaSignup, signupStatus }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-card border border-border shadow-md rounded-xl max-w-md mx-auto my-12 print:!hidden relative overflow-hidden">
        <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary"></div>
        <div className="bg-primary/10 text-primary p-4 rounded-full mb-6 ring-1 ring-primary/20"><Lock size={32} /></div>
        <h3 className="text-2xl font-bold mb-3 tracking-tight">Pro Access Required</h3>
        <p className="text-muted-foreground text-center mb-8 max-w-xs mx-auto leading-relaxed">
            Unlock financial data, 4P strategy, and export capabilities.
        </p>
        <form onSubmit={handleBetaSignup} className="w-full flex flex-col gap-4">
            <input
                type="email"
                required
                placeholder="Enter email..."
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
                type="submit"
                disabled={signupStatus === 'loading'}
                className="w-full font-semibold shadow"
                size="lg"
            >
                {signupStatus === 'loading' ? "Unlocking..." : "Unlock Report"}
            </Button>
        </form>
    </div>
);
