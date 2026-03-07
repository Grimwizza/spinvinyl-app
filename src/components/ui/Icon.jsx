import React from 'react';
import {
    Menu, X, Github, Mail,
    FlaskConical, ArrowLeft, ArrowRight,
    Loader2, Sparkles, Copy, Check, Upload, Image as ImageIcon, Zap, Share2, Facebook, Linkedin, Briefcase, Coffee, Lock, Unlock, Download, Printer
} from 'lucide-react';

// --- Custom X Logo Component ---
export const XLogo = ({ size = 24, color = "currentColor", className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={color} className={className}>
        <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
);

// --- Icon Mapping ---
const iconMap = {
    menu: Menu, x: X, twitter: XLogo, github: Github, mail: Mail,
    'flask-conical': FlaskConical, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight,
    loader: Loader2, sparkles: Sparkles, copy: Copy, check: Check,
    upload: Upload, image: ImageIcon, zap: Zap, share: Share2, facebook: Facebook, linkedin: Linkedin,
    briefcase: Briefcase, coffee: Coffee, lock: Lock, unlock: Unlock, download: Download, printer: Printer, close: X
};

export const Icon = ({ name, size = 24, color = "currentColor", className }) => {
    const LucideIcon = iconMap[name.toLowerCase()] || FlaskConical;
    return <LucideIcon size={size} color={color} className={className} />;
};
