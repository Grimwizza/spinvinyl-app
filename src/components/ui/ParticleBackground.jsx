import React, { useEffect, useRef } from 'react';

const ParticleBackground = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Particle configuration
        const particles = [];
        const particleCount = 60; // Not too crowded
        const connectionDistance = 150;
        const moveSpeed = 0.5;

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * moveSpeed;
                this.vy = (Math.random() - 0.5) * moveSpeed;
                this.size = Math.random() * 2 + 1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off edges
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(100, 150, 255, 0.5)'; // Soft blue
                ctx.fill();
            }
        }

        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        // Animation loop
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw background gradient (dark futuristic)
            // Note: Since the parent Hero has bg-black, we can just be transparent or add a subtle gradient here
            // Let's rely on particles being distinct

            // Update and draw particles
            particles.forEach((p, index) => {
                p.update();
                p.draw();

                // Draw connections
                for (let j = index + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < connectionDistance) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(100, 150, 255, ${0.15 * (1 - distance / connectionDistance)})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-transparent" />;
};

export default ParticleBackground;
