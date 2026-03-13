# Provider Setup for Real AI Generation

The Creative Optimization Lab supports **mock** and **real** execution modes. Mock mode uses local sample responses. Real mode calls actual OpenAI or Anthropic APIs for copy generation.

## Required Environment Variables

Copy `.env.example` to `.env.local` and add your API keys:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set:

| Variable | Required For | Description |
|----------|--------------|-------------|
| `OPENAI_API_KEY` | OpenAI copy generation | Your OpenAI API key |
| `OPENAI_MODEL` | OpenAI | Model to use (default: `gpt-4o-mini`) |
| `ANTHROPIC_API_KEY` | Anthropic copy generation | Your Anthropic API key |
| `ANTHROPIC_MODEL` | Anthropic | Model to use (default: `claude-3-5-haiku-20241022`) |

## Enabling Real Mode

1. Add the appropriate API key(s) to `.env.local`
2. Restart the dev server (`npm run dev`)
3. In the Creative Lab, open the "End-to-End Generation Pipeline" section
4. Set **Mode** to **Real**
5. Select a provider (OpenAI or Anthropic) that you have configured
6. Click "Run Real Copy"

## Testing with One Provider First

1. Add only `OPENAI_API_KEY` to `.env.local`
2. In the pipeline, select **Request type**: Copy generation, **Provider**: Mock OpenAI-style
3. Switch **Mode** to **Real**
4. The status bar will show "OpenAI: ✓" when configured
5. Click "Run Real Copy" to test

## Configuration Readiness

The UI shows provider readiness:

- **OpenAI: ✓** — `OPENAI_API_KEY` is set
- **OpenAI: ✗** — Key missing; add to `.env.local`
- **Anthropic: ✓** — `ANTHROPIC_API_KEY` is set
- **Anthropic: ✗** — Key missing

If a provider is not configured, the Real Copy button is disabled and a message explains what to add.

## Image Generation

Image variation generation uses a placeholder provider. Real image API integration is not yet implemented.
