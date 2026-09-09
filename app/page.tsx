"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, BadgeCheck, Braces, BrainCircuit, ChevronRight, FileCheck2, FlaskConical, Layers3, ShieldCheck, Sparkles, Zap } from "lucide-react";
import SceneCanvas from "@/components/SceneCanvas";
import WriterStudio from "@/components/WriterStudio";

const features = [
  { icon: BrainCircuit, title: "Reasoning-first writing", text: "Complex questions become coherent, structured academic work instead of generic paragraphs." },
  { icon: Layers3, title: "Format intelligence", text: "Lab mode can use an uploaded PDF, image or text sample as an optional structural reference." },
  { icon: FileCheck2, title: "Submission-ready output", text: "Clean Markdown, strong hierarchy, copy controls and instant document download." },
  { icon: ShieldCheck, title: "API key stays server-side", text: "Your OpenRouter key lives in Vercel environment variables, not inside the browser bundle." },
];

export default function Home() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.45], [0, 180]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <main>
      <div className="noise" />
      <div className="ambient a1" /><div className="ambient a2" /><div className="ambient a3" />

      <nav className="nav">
        <a className="brand" href="#top"><span className="brand-cube"><i /><i /><i /></span><b>ScholarForge</b><em>AI</em></a>
        <div className="nav-links"><a href="#capabilities">Capabilities</a><a href="#studio">Studio</a><a href="#developer">Developer</a></div>
        <a href="#studio" className="nav-cta">Launch writer <ChevronRight size={16} /></a>
      </nav>

      <section id="top" className="hero">
        <motion.div className="hero-copy" style={{ y: heroY, opacity: heroOpacity }}>
          <motion.div className="status-pill" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <span className="pulse" /> Powered by OpenRouter Free Router <BadgeCheck size={15} />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            Write smarter.<br /><span className="gradient-text">Submit beautifully.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.85 }}>
            A cinematic AI workspace engineered for professional assignments and lab tasks — with optional format matching, multimodal briefs, and an interface that feels one generation ahead.
          </motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <a className="primary-cta" href="#studio"><Sparkles size={18} /> Start creating <ChevronRight size={18} /></a>
            <a className="ghost-cta" href="#capabilities"><ArrowDown size={17} /> Explore system</a>
          </motion.div>
          <div className="metric-row">
            <div><strong>2</strong><span>specialized modes</span></div>
            <div><strong>3D</strong><span>motion interface</span></div>
            <div><strong>200K</strong><span>router context</span></div>
          </div>
        </motion.div>

        <motion.div className="hero-visual" initial={{ opacity: 0, scale: 0.84, rotateY: -18 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}>
          <SceneCanvas />
          <motion.div className="float-card fc1" animate={{ y: [0, -12, 0], rotateZ: [-4, -2, -4] }} transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}><FlaskConical size={18} /><span><b>Lab format detected</b><small>Structure synchronized</small></span></motion.div>
          <motion.div className="float-card fc2" animate={{ y: [0, 14, 0], rotateZ: [4, 2, 4] }} transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}><Braces size={18} /><span><b>Academic engine</b><small>Reasoning in progress</small></span></motion.div>
          <div className="orbital-label ol1">STRUCTURE</div><div className="orbital-label ol2">REASON</div><div className="orbital-label ol3">REFINE</div>
        </motion.div>
      </section>

      <section className="marquee-wrap" aria-hidden="true"><div className="marquee">ASSIGNMENT WRITER <i>✦</i> LAB TASK ENGINE <i>✦</i> MULTIMODAL INPUT <i>✦</i> FORMAT MATCHING <i>✦</i> 3D EXPERIENCE <i>✦</i> ACADEMIC QUALITY <i>✦</i></div></section>

      <section id="capabilities" className="capabilities">
        <div className="section-heading"><span className="eyebrow"><Zap size={14} /> CAPABILITIES</span><h2>Designed like a product.<br /><em>Not a prompt box.</em></h2><p>Every interaction is optimized around turning raw questions into clear, polished academic work.</p></div>
        <div className="feature-grid">
          {features.map((f, i) => <motion.article key={f.title} className="feature-card" initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ delay: i * 0.08, duration: 0.65 }} whileHover={{ y: -8, rotateX: 2, rotateY: i % 2 ? -2 : 2 }}><div className="feature-icon"><f.icon /></div><span>0{i + 1}</span><h3>{f.title}</h3><p>{f.text}</p><div className="card-sheen" /></motion.article>)}
        </div>
      </section>

      <WriterStudio />

      <section id="developer" className="developer-section">
        <div className="dev-stage">
          <div className="dev-rings"><i /><i /><i /></div>
          <motion.div className="dev-card" initial={{ opacity: 0, scale: 0.85, rotateX: 14 }} whileInView={{ opacity: 1, scale: 1, rotateX: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} whileHover={{ rotateY: -4, rotateX: 3, y: -6 }}>
            <span className="dev-kicker">DESIGNED · ENGINEERED · DEVELOPED BY</span>
            <h2 data-text="SAMIR PURI">SAMIR PURI</h2>
            <div className="dev-line"><span /> <Sparkles size={17} /> <span /></div>
            <p>Crafting intelligent interfaces where code, motion and visual depth become one experience.</p>
          </motion.div>
        </div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-cube"><i /><i /><i /></span><b>ScholarForge</b><em>AI</em></a><p>Assignment Writer · Lab Task Writer · Built for Vercel</p><span>© 2026 Samir Puri</span></footer>
    </main>
  );
}
