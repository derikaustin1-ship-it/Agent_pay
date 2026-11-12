'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { CopilotActionProposal, ProductRecommendation } from '@/types';
import {
  Sparkles,
  X,
  Send,
  ShoppingCart,
  Heart,
  Scale,
  ShieldCheck,
  Maximize2,
  ExternalLink,
  Check,
} from 'lucide-react';

const QUICK_PROMPTS = [
  'Find me the best phone under ₹20,000',
  'Suggest a good gift under $35',
  'Find a laptop suitable for programming',
  'Show me the best available deals',
];

export function FloatingAICopilot() {
  const router = useRouter();
  const {
    state,
    openCopilot,
    closeCopilot,
    sendMessage,
    addToCart,
    toggleWishlist,
    toggleCompare,
    formatPrice,
    showToast,
  } = useApp();

  const [input, setInput] = useState('');
  const [prevPrompt, setPrevPrompt] = useState<string | null>(null);
  const [executedActions, setExecutedActions] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  if (state.copilotOpen && state.copilotInitialPrompt && state.copilotInitialPrompt !== prevPrompt) {
    setPrevPrompt(state.copilotInitialPrompt);
    setInput(state.copilotInitialPrompt);
  } else if (!state.copilotOpen && prevPrompt !== null) {
    setPrevPrompt(null);
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.copilotOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || state.isTyping) return;
    setInput('');
    await sendMessage(trimmed);
  };

  const findProductById = (productId?: string): ProductRecommendation | undefined => {
    if (!productId) return undefined;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const match = state.messages[i].products?.find((p) => p.product.id === productId);
      if (match) return match;
    }
    return undefined;
  };

  const handleConfirmAction = async (action: CopilotActionProposal) => {
    if (action.type === 'add_to_cart' && action.productId) {
      const rec = findProductById(action.productId);
      if (rec) {
        const ok = await addToCart(rec.product, action.quantity || 1, false);
        if (ok) setExecutedActions((prev) => ({ ...prev, [action.id]: true }));
      }
    } else if (action.type === 'add_to_wishlist' && action.productId) {
      const rec = findProductById(action.productId);
      if (rec) {
        await toggleWishlist(rec.product);
        setExecutedActions((prev) => ({ ...prev, [action.id]: true }));
      }
    } else if (action.type === 'compare_products' && action.productIds) {
      for (const pid of action.productIds) {
        const rec = findProductById(pid);
        if (rec) toggleCompare(rec.product);
      }
      setExecutedActions((prev) => ({ ...prev, [action.id]: true }));
      closeCopilot();
      router.push('/compare');
    } else if (action.type === 'open_checkout') {
      closeCopilot();
      router.push('/checkout');
    } else {
      showToast('Action could not find target product context', 'error');
    }
  };

  const remainingDaily = state.spendingSummary?.remainingDailyBudget ?? state.budget?.dailySpendingLimit;

  if (!state.copilotOpen) {
    return (
      <button
        type="button"
        onClick={() => openCopilot()}
        aria-label="Open AgentPay AI Co-Pilot"
        className="fixed bottom-5 right-5 z-40 group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-4 py-3 text-white shadow-xl hover:shadow-2xl hover:scale-[1.03] transition-all"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="text-left pr-1">
          <p className="text-xs font-bold leading-tight">AI Shopping Co-Pilot</p>
          <p className="text-[10px] text-indigo-100 leading-tight">Search • Compare • Budget</p>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[430px] h-[600px] max-h-[82vh] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-4 py-3 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">AgentPay AI Co-Pilot</h3>
            <p className="text-[11px] text-indigo-100 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {remainingDaily !== undefined
                ? `Daily left: ${formatPrice(remainingDaily, false, state.budget?.currency || 'USD')}`
                : 'Gemini + Channel3 + Budget Guard'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/assistant"
            onClick={closeCopilot}
            title="Expand full AI Assistant page"
            className="rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/10"
          >
            <Maximize2 className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={closeCopilot}
            aria-label="Minimize AI Co-Pilot"
            className="rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
        {state.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-xs'
              }`}
            >
              {msg.isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                  <span>{msg.searchStatus || 'Thinking...'}</span>
                </div>
              ) : (
                msg.content
              )}
            </div>

            {/* Product Recommendations inline */}
            {msg.products && msg.products.length > 0 && (
              <div className="mt-2 w-full space-y-2">
                {msg.products.slice(0, 3).map((rec) => {
                  const isExternal = rec.product.checkoutType === 'external';
                  return (
                    <div
                      key={rec.product.id}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex gap-2.5 items-center"
                    >
                      <img
                        src={rec.product.imageUrl}
                        alt={rec.product.name}
                        className="h-12 w-12 rounded-lg object-contain bg-slate-50 p-1 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/products/${encodeURIComponent(rec.product.id)}`}
                          onClick={closeCopilot}
                          className="text-xs font-semibold text-slate-900 line-clamp-1 hover:text-indigo-600"
                        >
                          {rec.product.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-slate-900">
                            {formatPrice(
                              rec.product.originalPrice ?? rec.product.price,
                              false,
                              rec.product.originalCurrency || rec.product.currency
                            )}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              isExternal
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {isExternal ? rec.product.seller : 'AgentPay Checkout'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {isExternal ? (
                          <a
                            href={rec.product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-600"
                          >
                            Visit
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(rec.product, 1, false)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                          >
                            <ShoppingCart className="w-2.5 h-2.5" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Explicit Confirmation Action Buttons */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 w-full">
                {msg.actions.map((act) => {
                  const done = !!executedActions[act.id];
                  return (
                    <button
                      key={act.id}
                      type="button"
                      disabled={done}
                      onClick={() => handleConfirmAction(act)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border transition ${
                        done
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {done ? (
                        <Check className="w-3 h-3" />
                      ) : act.type === 'add_to_cart' ? (
                        <ShoppingCart className="w-3 h-3" />
                      ) : act.type === 'add_to_wishlist' ? (
                        <Heart className="w-3 h-3" />
                      ) : (
                        <Scale className="w-3 h-3" />
                      )}
                      {done ? 'Confirmed' : act.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prompt Pills */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto shrink-0">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => sendMessage(q)}
            disabled={state.isTyping}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about phones, deals, gifts, specs..."
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || state.isTyping}
          aria-label="Send message"
          className="rounded-xl bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
