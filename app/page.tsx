"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

const protectedTools = ["ChatGPT", "Copilot", "Gemini", "Claude", "Cursor"];

const catchList = [
  "Source Code Leaks",
  "PII / PHI Data",
  "API Keys & Secrets",
  "Financial Records",
  "Internal Meeting Transcripts",
];

const testimonials = [
  {
    avatar: "EN",
    role: "Engineer, fintech platform",
    quote:
      "PromptShield intercepted risky prompts without slowing our AI workflows. The team kept shipping, and sensitive code stayed inside the network.",
  },
  {
    avatar: "CI",
    role: "CISO, healthcare network",
    quote:
      "The PHI controls gave us the confidence to roll out AI assistants across clinical teams without creating a new exposure surface.",
  },
  {
    avatar: "CT",
    role: "CTO, enterprise SaaS",
    quote:
      "Deployment was clean. We pointed traffic through the gateway, tuned policies, and had usable reporting before the first review meeting.",
  },
];

const caseStudies = [
  "Preventing a Samsung-scale source code leak at a semiconductor firm",
  "Zero PHI exposure across 4,000 hospital staff using Copilot",
  "Blocking 12,000 API key leaks in 30 days at a SaaS company",
];

const insights = [
  {
    date: "May 18, 2026",
    title: "The $40M mistake: why engineers leak IP through AI tools",
  },
  {
    date: "Apr 29, 2026",
    title: "Edge inference vs. cloud scanning: what enterprises get wrong",
  },
];

function SectionRule() {
  return <div className="h-px w-full bg-[#F5C518]/70" />;
}

function TerminalShield() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[520px] overflow-hidden rounded-lg border border-[#F5C518]/30 bg-[#121212] shadow-[0_0_80px_rgba(245,197,24,0.10)]">
      <div className="flex h-10 items-center gap-2 border-b border-[#F5C518]/20 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#F5C518]" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
      </div>
      <div className="grid h-[calc(100%-2.5rem)] grid-cols-[1fr_0.9fr]">
        <div className="space-y-4 p-5 font-mono text-xs text-[#A0A0A0] sm:p-7">
          {[
            "$ promptshield inspect --edge",
            "routing: local gateway",
            "finding: AWS_SECRET_ACCESS_KEY",
            "action: redact + notify",
            "status: blocked before egress",
          ].map((line, index) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.16, duration: 0.45 }}
              className={index === 0 ? "text-[#F5C518]" : ""}
            >
              {line}
            </motion.p>
          ))}
        </div>
        <div className="relative flex items-center justify-center border-l border-[#F5C518]/20">
          <div className="absolute inset-8 rounded-full bg-[#F5C518]/10 blur-2xl" />
          <div className="relative flex h-32 w-24 items-center justify-center border-2 border-[#F5C518] bg-[#0D0D0D] [clip-path:polygon(50%_0,92%_16%,85%_76%,50%_100%,15%_76%,8%_16%)] sm:h-44 sm:w-32">
            <div className="h-12 w-12 rounded-full border border-[#F5C518]/70" />
            <div className="absolute h-16 w-px bg-[#F5C518]/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductVisual() {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#F5C518]/30 pb-3">
        <p className="text-xs uppercase tracking-[0.3em] text-[#F5C518]">
          Live policy engine
        </p>
        <span className="shrink-0 rounded-full border border-[#F5C518]/40 px-3 py-1 text-xs text-white">
          0ms cloud egress
        </span>
      </div>
      <div className="space-y-3">
        {["Secret detected", "PHI redacted", "Source diff blocked", "Audit event"].map(
          (item, index) => (
            <div
              key={item}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md bg-[#0D0D0D] p-3"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5C518]" />
              <span className="text-sm text-white">{item}</span>
              <span className="font-mono text-xs text-[#A0A0A0]">
                00.0{index + 3}s
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0D0D0D]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#" className="text-lg font-semibold tracking-tight">
            PromptShield<span className="text-[#F5C518]">&copy;</span>
          </a>
          <div className="hidden items-center gap-8 text-sm text-[#A0A0A0] md:flex">
            <a href="#catch" className="hover:text-white">
              What we catch
            </a>
            <a href="#why" className="hover:text-white">
              Why us
            </a>
            <a href="#cases" className="hover:text-white">
              Case studies
            </a>
          </div>
          <Button className="h-10 px-5">See it live</Button>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-18 pt-14 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:pb-24 lg:pt-20">
        <motion.div {...fadeUp} className="flex flex-col justify-center">
          <div className="mb-8 w-fit border border-[#F5C518]/60 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#F5C518]">
            Protecting teams in San Francisco, USA
          </div>
          <h1 className="max-w-4xl font-serif text-[clamp(3.5rem,10vw,7rem)] leading-[0.95] tracking-tight text-white">
            PromptShield&copy;
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#A0A0A0] sm:text-xl sm:leading-9">
            The AI firewall that lets your team move fast &mdash; without
            leaking what matters.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button>See it live</Button>
            <Button variant="outline">Read the case study</Button>
          </div>
        </motion.div>
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
          <TerminalShield />
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionRule />
        <motion.div {...fadeUp} className="py-12">
          <p className="max-w-2xl text-sm uppercase tracking-[0.24em] text-[#A0A0A0]">
            Intercepts prompts sent to these tools before data leaves your
            network
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {protectedTools.map((tool) => (
              <div
                key={tool}
                className="flex h-20 items-center justify-center rounded-md border border-white/10 bg-[#1A1A1A] text-base font-semibold text-white transition-colors hover:border-[#F5C518] sm:text-lg"
              >
                {tool}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section id="catch" className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionRule />
        <div className="grid gap-12 py-18 lg:grid-cols-[1fr_0.85fr] lg:py-20">
          <motion.div {...fadeUp}>
            <p className="mb-8 text-sm uppercase tracking-[0.26em] text-[#F5C518]">
              What we catch
            </p>
            <div className="space-y-5">
              {catchList.map((item) => (
                <h2
                  key={item}
                  className="border-b border-white/10 pb-5 font-serif text-[clamp(2rem,5vw,3.5rem)] leading-tight text-white transition-colors hover:border-[#F5C518]"
                >
                  {item}
                </h2>
              ))}
            </div>
          </motion.div>
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
            <ProductVisual />
          </motion.div>
        </div>
      </section>

      <section id="why" className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionRule />
        <motion.div {...fadeUp} className="py-18 lg:py-20">
          <h2 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-tight text-white">
            <span className="text-[#F5C518]">&middot;</span> Why{" "}
            <span className="text-[#F5C518]">&middot;</span> Choose Us
          </h2>
          <div className="mt-10 rounded-lg border border-[#F5C518]/30 bg-[#1A1A1A] p-7 sm:p-10">
            <p className="text-xl font-semibold text-white sm:text-2xl">
              Edge-First Architecture
            </p>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[#A0A0A0] sm:text-lg">
              Scanning happens on your network, with zero data sent to cloud.
            </p>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {testimonials.map((item) => (
              <div
                key={item.role}
                className="rounded-lg border border-white/10 bg-[#1A1A1A] p-6 transition-colors hover:border-[#F5C518]"
              >
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#F5C518] text-sm font-semibold text-[#F5C518]">
                    {item.avatar}
                  </div>
                  <p className="text-sm text-[#A0A0A0]">{item.role}</p>
                </div>
                <p className="text-base leading-8 text-white sm:text-lg">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section id="cases" className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionRule />
        <motion.div {...fadeUp} className="py-18 lg:py-20">
          <h2 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-tight text-white">
            <span className="text-[#F5C518]">&middot;</span> Recent{" "}
            <span className="text-[#F5C518]">&middot;</span> Case Studies
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {caseStudies.map((item, index) => (
              <article
                key={item}
                className="min-h-60 rounded-lg border border-white/10 bg-[#1A1A1A] p-7 transition-colors hover:border-[#F5C518]"
              >
                <p className="font-mono text-sm text-[#F5C518]">
                  0{index + 1}
                </p>
                <h3 className="mt-12 text-xl font-semibold leading-snug text-white sm:text-2xl">
                  {item}
                </h3>
              </article>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionRule />
        <motion.div {...fadeUp} className="py-18 lg:py-20">
          <h2 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-tight text-white">
            <span className="text-[#F5C518]">&middot;</span> Latest{" "}
            <span className="text-[#F5C518]">&middot;</span> Insights & Updates
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {insights.map((item, index) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-lg border border-white/10 bg-[#1A1A1A] transition-colors hover:border-[#F5C518]"
              >
                <div className="flex h-56 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(245,197,24,0.18),transparent_48%),#111]">
                  <div className="h-24 w-24 border border-[#F5C518]/70" />
                  <span className="ml-[-3rem] mt-16 font-mono text-sm text-[#F5C518]">
                    0{index + 1}
                  </span>
                </div>
                <div className="p-7">
                  <p className="text-sm uppercase tracking-[0.22em] text-[#A0A0A0]">
                    {item.date}
                  </p>
                  <h3 className="mt-4 text-xl font-semibold leading-snug text-white sm:text-2xl">
                    {item.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </motion.div>
      </section>

      <footer className="mx-auto max-w-7xl px-5 pb-8 pt-12 sm:px-8">
        <SectionRule />
        <div className="py-14">
          <h2 className="font-serif text-[clamp(3.2rem,13vw,8rem)] leading-none tracking-tight text-white">
            PromptShield&copy;
          </h2>
          <div className="mt-12 grid gap-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Main Page", "Home", "What We Catch", "Why PromptShield"],
              ["Inner Page", "Case Studies", "Insights", "Security"],
              ["Utility Page", "Privacy", "Terms", "Status"],
              ["Social Media", "LinkedIn", "X / Twitter", "YouTube"],
            ].map(([title, ...links]) => (
              <div key={title}>
                <p className="mb-4 font-semibold text-white">{title}</p>
                <div className="space-y-3 text-[#A0A0A0]">
                  {links.map((link) => (
                    <a key={link} href="#" className="block hover:text-[#F5C518]">
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-sm text-[#A0A0A0]">
          &copy; 2026 PromptShield. Enterprise AI DLP gateway.
        </div>
      </footer>
    </main>
  );
}
