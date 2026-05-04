 Setup Before Recording

  - Open http://localhost:3001 in browser
  - Make sure server is running (npm run dev)
  - Use a clean browser window (no extensions visible)
  - Resize to ~480px width if possible (looks like a side panel)

  ---
  Scene 1: First Impression (15 sec)

  ▎ Show the clean light UI with Amit's avatar and quick actions

  On screen: Welcome screen with "Amit — CWS Technology" header and 4 quick action buttons

  You say: "This is an AI-powered sales agent for CWS Technology. It looks like a modern chat
  assistant that you can embed on any website."

  ---
  Scene 2: Building a New Product (2 min)

  ▎ Click "Build new product" quick action

  You say: "Let's say a client visits our website and wants to build a new product."

  - Click "Build new product"
  - Type: "I want to build an e-commerce store for selling handmade jewelry"
  - Amit responds and asks follow-up questions
  - Answer ONE question at a time:
    - "Customers who buy handmade products, mostly women aged 25-45"
    - "Product catalog, cart, payment integration, order tracking"
    - "I want it live in 2 months"

  You say: "Notice how Amit asks one question at a time, summarizes, and builds understanding —
  just like a real sales consultant."

  ---
  Scene 3: Estimate Generation (1 min)

  ▎ Give name and email to trigger estimate

  - Type: "I'm Priya, my email is priya@example.com"

  You say: "Once Amit has enough info and the client's contact details, it generates a structured
  estimate with two options — MVP and Full Build — along with a disclaimer."

  - Show the estimate card with pricing breakdown
  - Show the disclaimer at the bottom
  - Show the time slot cards that appear automatically

  ---
  Scene 4: Booking a Call (30 sec)

  ▎ Click on a time slot

  You say: "Calendar slots appear automatically. The client just picks one."

  - Click any slot
  - Show the booking confirmation card

  ---
  Scene 5: Multi-Language Support (45 sec)

  ▎ Start a new conversation (refresh page) and type in Hindi

  - Type: "मुझे एक मोबाइल ऐप बनवाना है"

  You say: "The agent supports Hindi, Tamil, Telugu, and other Indian languages. It detects the
  language automatically and responds in the same language."

  - Show Amit responding in Hindi
  - Type: "budget thoda kam hai"
  - Show negotiation in Hinglish

  ---
  Scene 6: Price Negotiation (30 sec)

  ▎ Continue from Scene 3 or start fresh

  - Type: "This is too expensive, can you reduce the price?"

  You say: "If the client pushes back on pricing, the negotiation agent handles it with phased
  delivery, reduced MVP, or payment plan options."

  ---
  Scene 7: Voice Input (30 sec)

  ▎ Click the mic button

  You say: "Clients can also speak instead of typing using the built-in voice input."

  - Click the mic button
  - Speak: "I want to build a real estate website"
  - Show text filling the input field
  - Press Enter manually

  ---
  Scene 8: Portfolio / RAG Search (30 sec)

  ▎ Start fresh conversation

  - Type: "Show me your past projects"

  You say: "When a client asks about our work, the agent searches our portfolio using semantic
  search powered by Supabase pgvector and shows project cards."

  - Show project cards appearing
  - If projects have URLs, show the "View Project →" links

  ---
  Scene 9: Edge Cases (1 min)

  Gibberish:
  - Type: "asdfghjk qwerty"
  - Show Amit saying "I didn't quite get that"

  Short/Vague:
  - Type: "hmm ok"
  - Show Amit gently nudging back

  Off-topic:
  - Type: "write me a python script"
  - Show Amit redirecting to project discussion

  ---
  Scene 10: Embedding on Any Website (30 sec)

  ▎ Show the widget/embed options

  You say: "You can embed this agent anywhere — as a floating chat bubble widget or as an inline
  side panel."

  - Show widget.js — floating bubble on bottom-right
  - Show embed.js — iframe embed in a page
  - Or just show the clean full-page view

  ---
  Scene 11: Behind the Scenes (optional, 1 min)

  ▎ Quick technical overview if audience is technical

  You say: "Under the hood: LangGraph multi-agent architecture with Gemini 2.5 Flash, Supabase
  pgvector for semantic search, Google Calendar for booking, and Nodemailer for confirmations.
  Fully configurable via pricing.json."

  ---
  Total Time: ~8-9 minutes

  Pro Tips for Recording: