/**
 * CV content. Kept as typed data so the page stays declarative; update it here, not in the JSX.
 * The phone number is deliberately not published on the site.
 */
export type ExperienceGroup = { title?: string; bullets: readonly string[] };

export type Experience = {
  role: string;
  organization: string;
  location?: string;
  period: string;
  groups: readonly ExperienceGroup[];
};

export type CvProject = {
  title: string;
  tag: string;
  bullets: readonly string[];
};

export const cv = {
  title: "AI / ML Engineer",
  location: "Bratislava, Slovakia",
  summary:
    "AI/ML engineer with hands-on experience in fine-tuning and quantizing LLMs, building RAG pipelines and multi-agent systems, and shipping them as production backend services. Databricks-certified data engineer who also builds the surrounding platform: ETL pipelines, CI/CD, and self-hosted infrastructure. Bridges research and engineering, and works directly with data analysts, data engineers, and clients.",
  skills: [
    {
      label: "AI / ML",
      items: [
        "Python",
        "PyTorch",
        "LLM fine-tuning",
        "RAG",
        "AI Agents (LangGraph, LangSmith)",
        "Vector databases",
      ],
    },
    {
      label: "Data & Backend",
      items: [
        "Databricks",
        "PySpark",
        "Delta Lake",
        "ETL",
        "SQL",
        "NoSQL",
        "FastAPI",
        "MongoDB",
        "Redis",
      ],
    },
    {
      label: "Cloud & DevOps",
      items: ["Azure", "Terraform", "Docker", "GitHub Actions (CI/CD)", "Linux"],
    },
  ],
  languages: [
    { name: "English", level: "C1" },
    { name: "Slovak", level: "C1" },
    { name: "German", level: "B2" },
    { name: "Ukrainian", level: "Fluent" },
    { name: "Russian", level: "Fluent" },
  ],
  experience: [
    {
      role: "Data Developer",
      organization: "Adastra",
      location: "Bratislava, Slovakia",
      period: "03/2026 — Present",
      groups: [
        {
          bullets: [
            "Led development of an internal migration engine and built Python automation scripts that generate mapping templates for data analysts, removing repetitive manual setup from migration projects.",
            "Designed and maintained ETL pipelines and transformation workflows that deliver clean, reliable datasets for reporting and decision-making.",
            "Designed and deployed a self-hosted internal platform on company servers, with all services containerized with Docker and managed through Arcane.",
            "Built CI/CD workflows in GitHub Actions for AI-assisted data transformation, assembling prompts dynamically from pipeline metadata and routing them to an LLM through an internal integration tool.",
            "Introduced AI tooling into the team's workflow and advised colleagues on AI use cases, solution design, and best practices.",
          ],
        },
      ],
    },
    {
      role: "AI Engineer",
      organization: "Leadgram",
      period: "06/2026 — Present",
      groups: [
        {
          bullets: [
            "Joined the engineering team of an AI product that finds and ranks people from public Telegram messages using hybrid semantic search and a Rust backend.",
            "Worked on the Rust search service (hybrid retrieval, rank fusion, reranking, query understanding) and its parity tests against the Python data pipeline.",
            "Contributed to the AI support agent (LangGraph, Azure OpenAI, RAG over a Qdrant knowledge base, safety guardrails, human handoff).",
            "Operate in a production environment with Kubernetes, GitOps (ArgoCD), and Terraform-managed infrastructure.",
          ],
        },
      ],
    },
    {
      role: "AI Engineer",
      organization: "TeamChallange",
      period: "05/2025 — 02/2026",
      groups: [
        {
          title: "PII Removal System",
          bullets: [
            "Built a PII anonymization pipeline from fine-tuned XLM-RoBERTa NER models and rule-based heuristics, served through a FastAPI API and web interface for real-time document redaction.",
            "Engineered batch ingestion from Azure Blob Storage with OCR; added OpenAI API as a secondary validator for complex unstructured text; containerized with Docker.",
            "Result: 97%+ NER F1 and throughput of 500 documents/minute.",
          ],
        },
        {
          title: "Client Fetcher (multi-agent lead system)",
          bullets: [
            "Architected a LangGraph multi-agent system: one agent classifies incoming Telegram messages and stores leads, a second retrieves leads and autonomously conducts the dialogue.",
            "Integrated it with async PostgreSQL and the Telegram API (Telethon) in a containerized Docker pipeline.",
            "Result: Autonomous lead detection, qualification, and escalation that replaced manual lawyer outreach.",
          ],
        },
        {
          title: "Backend-Shop (microservices)",
          bullets: [
            "Built four Spring Boot services (API Gateway, Auth, Product, Notification) with JWT, role-based access, Google OAuth2, RabbitMQ messaging, and Docker deployment.",
          ],
        },
      ],
    },
  ] as readonly Experience[],
  projects: [
    {
      title: "Efficient Legal AI: Quantized LLMs with Fine-Tuning",
      tag: "Bachelor Thesis, FIIT STU (2026/27)",
      bullets: [
        "Built a Python evaluation framework (PyTorch, Transformers, bitsandbytes, llama.cpp) to measure how post-training quantization (GGUF q4/q8, int8, NF4) affects Qwen2.5-3B across 145 LegalBench tasks (84.7k examples), using KV-cache prefill reuse, dynamic batching with OOM recovery, and a verification gate against a reference scorer.",
        "Implemented QLoRA/LoRA training pipelines with checkpoint selection, 3-seed replication, and merge-and-requantize, plus a generation-based scoring mode compatible with the original LegalBench protocol.",
        "Used rigorous statistics (balanced accuracy, task-stratified paired bootstrap CIs, McNemar) and found and corrected several evaluation pitfalls.",
        "Results: quantization cost only 0.3–0.6 pp, while in-distribution fine-tuning gained +14.6 pp (69.4% → 84.0%), about 26x the quantization loss. Merge-and-requantize kept 97–101% of the gain with higher inference throughput (21.0k vs 13.7k tokens/s).",
      ],
    },
    {
      title: "LabelMe Object Recognition System",
      tag: "Computer Vision",
      bullets: [
        "Built a multi-label classification pipeline on LabelMe-12-50k, handling extreme class imbalance with data augmentation and a ResNet-based architecture with skip connections.",
        "Result: 91% F1 in multi-class tasks and 80.2% subset accuracy in multi-label detection.",
      ],
    },
  ] as readonly CvProject[],
  certifications: [
    { date: "Sep 2026", name: "Databricks Certified Data Engineer Associate" },
    { date: "Aug 2026", name: "IELTS Academic (C1)" },
  ],
  education: {
    period: "2024 – 2027",
    degree: "Bachelor of Science: Computer Science",
    school: "Slovak University of Technology (FIIT), Bratislava, SK",
    notes: ["Ranked in the top 7% of students; recipient of the faculty merit scholarship."],
  },
} as const;
