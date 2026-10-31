export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
      <h1>Pramaan</h1>
      <p>
        Fact-checking for code: Pramaan splits a GitHub issue or pull request into technical claims, tests each
        claim against the repository, and shows maintainers the evidence. When it cannot verify a claim, it says
        so.
      </p>
    </main>
  );
}
