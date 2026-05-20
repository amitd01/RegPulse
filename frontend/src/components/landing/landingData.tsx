import type { ReactNode } from "react";

export type Feature = {
  title: string;
  description: string;
  icon: ReactNode;
};

export type CircularRow = {
  id: string;
  title: string;
  date: string;
  badge: string;
  badgeClass: "updated" | "new-b" | "circular";
  isNew?: boolean;
};

export type Testimonial = {
  quote: string;
  initials: string;
  name: string;
  role: string;
};

export const FEATURES: Feature[] = [
  {
    title: "Exact Circular Citations",
    description:
      "Every answer is grounded in specific RBI circulars — including the circular number, date, and relevant clause. No guesswork.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    title: "Instant Interpretation",
    description:
      "Get plain-language answers in under 3 seconds. No more reading 40-page master directions to find one relevant clause.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "Live Regulatory Alerts",
    description:
      "Get notified the moment a new RBI circular drops that affects your entity type — PPIs, NBFCs, banks, or fintechs.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
        />
      </svg>
    ),
  },
  {
    title: "Action Item Tracking",
    description:
      "Compliance deadlines surfaced automatically from relevant circulars, with priority tagging and due-date tracking built in.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"
        />
      </svg>
    ),
  },
  {
    title: "Save Interpretations",
    description:
      "Bookmark key regulatory answers and build a team-wide library of interpretations. Share with auditors or legal in one click.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    ),
  },
  {
    title: "Entity-specific Context",
    description:
      "Tell RegPulse your entity type once — and every answer is tailored to what applies to you, not the general market.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"
        />
      </svg>
    ),
  },
];

export const STEPS = [
  {
    num: "1",
    title: "Ask your question",
    desc: "Type any RBI compliance question in plain English — no need to know circular numbers or legal jargon.",
  },
  {
    num: "2",
    title: "AI searches circulars",
    desc: "RegPulse scans 2,400+ indexed RBI documents, identifying the most relevant clauses to your specific query.",
  },
  {
    num: "3",
    title: "Get cited answers",
    desc: "Receive a precise, plain-language interpretation with exact circular references — ready for leadership or auditors.",
  },
];

export const CIRCULARS: CircularRow[] = [
  {
    id: "RBI/2015-16/42",
    title: "Master Direction – Know Your Customer (KYC) Direction, 2016",
    date: "14 Mar 2024",
    badge: "Updated",
    badgeClass: "updated",
    isNew: true,
  },
  {
    id: "DPSS.CO.PD.No.3489",
    title: "Prepaid Payment Instruments – Revised Outstanding Balance Limits",
    date: "10 May 2026",
    badge: "New",
    badgeClass: "new-b",
    isNew: true,
  },
  {
    id: "RBI/2022-23/111",
    title: "Digital Lending Guidelines – Regulated Entities & LSPs",
    date: "02 Sep 2022",
    badge: "Circular",
    badgeClass: "circular",
  },
  {
    id: "RBI/2021-22/112",
    title: "Scale Based Regulation – Revised Regulatory Framework for NBFCs",
    date: "22 Oct 2021",
    badge: "Direction",
    badgeClass: "circular",
  },
  {
    id: "RBI/DPSS/2017-18/58",
    title: "Master Direction on Prepaid Payment Instruments (Updated)",
    date: "Jan 2025",
    badge: "Updated",
    badgeClass: "updated",
    isNew: true,
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "What used to take our compliance team half a day now takes 3 minutes. The citations are accurate and the interpretations are exactly what you'd share with your board.",
    initials: "AK",
    name: "Ankit Kapoor",
    role: "Chief Compliance Officer, Fintech NBFC",
  },
  {
    quote:
      "RegPulse caught an update to the PPI master direction that I hadn't spotted. The live alerts alone are worth the subscription for any payments company.",
    initials: "PR",
    name: "Priya Ramesh",
    role: "Head of Legal, Digital Payments Startup",
  },
  {
    quote:
      "We use RegPulse before every product launch. Having cited answers reduces our legal review cycles dramatically. It's become part of our compliance workflow.",
    initials: "VS",
    name: "Vikram Sharma",
    role: "VP Compliance, Mid-size Bank",
  },
];
