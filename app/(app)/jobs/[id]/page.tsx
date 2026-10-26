import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { snapshot, loadSnapshot } from "../../../../lib/feeds";
import { currentSession } from "../../../../lib/auth";
import { jobsMeta } from "../../../../lib/profiles";
import { sourceName } from "../../../../lib/catalog";
import JobClient from "./job-client";

export const dynamic = "force-dynamic";

const findJob = async (raw: string) => {
  const id = decodeURIComponent(raw);
  const snap = await snapshot("").catch(() => null);
  return { id, job: snap?.jobs.find((j) => j.id === id) };
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: raw } = await params;
  const { id, job } = await findJob(raw);
  if (!job) return { title: "Listing unavailable" };
  const desc = (
    job.summary ||
    `${job.title} at ${job.company} — ${job.location}${job.remote ? " · Remote" : ""}. Aggregated by Job Atlas.`
  ).slice(0, 160);
  const path = `/jobs/${encodeURIComponent(id)}`;
  return {
    title: `${job.title} at ${job.company}`,
    description: desc,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title: `${job.title} at ${job.company}`,
      description: desc,
      url: path,
    },
    twitter: { card: "summary_large_image", title: `${job.title} at ${job.company}`, description: desc },
  };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const { id, job } = await findJob(raw);
  if (!job) notFound();
  const me = await currentSession();
  const initial = await loadSnapshot(me?.email || "");
  const meta = await jobsMeta(me);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const ldJob = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.summary || `${job.title} at ${job.company} — ${job.location}`,
    datePosted: job.posted || undefined,
    url: `${process.env.APP_ORIGIN || "http://localhost:3000"}/jobs/${encodeURIComponent(id)}`,
    employmentType: job.remote ? "REMOTE" : undefined,
    hiringOrganization: { "@type": "Organization", name: job.company },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location } },
    jobLocationType: job.remote ? "TELECOMMUTE" : undefined,
    directApply: job.url,
    identifier: { "@type": "PropertyValue", name: sourceName(job.source), value: job.id },
  }).replace(/</g, "\\u003c");
  return (
    <>
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJob }} />
      <Suspense fallback={null}>
        <JobClient id={id} initial={initial} meta={meta} />
      </Suspense>
    </>
  );
}
