'use client';

import React from 'react';
import ChatAssistant from '@/components/ChatAssistant';

export default function AssistantPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[75vh]">
        <ChatAssistant />
      </div>
    </div>
  );
}
