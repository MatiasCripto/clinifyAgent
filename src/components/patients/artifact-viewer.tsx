'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'

interface Props {
  type: string
  data?: Record<string, unknown> | null
  readOnly?: boolean
  onDataChange?: (data: Record<string, unknown>) => void
}

const INJECTED_SCRIPT = `
<script>
(function() {
  if (window.__clinifyInjected) return;
  window.__clinifyInjected = true;

  // Notify parent we're ready
  requestAnimationFrame(function() { requestAnimationFrame(function() { window.parent.postMessage({ type: 'artifact:ready' }, '*'); }); });

  // Listen for load/restore from parent
  window.addEventListener('message', function(e) {
    if (e.data?.type === 'artifact:load' && e.data.data) {
      try { if (typeof loadState === 'function') loadState(e.data.data); } catch(ex) {}
    }
  });

  // Assign stable keys to elements without id/name
  var _keyCounter = 0;
  function ensureKey(el, tag, idx) {
    if (el.id) return el.id;
    if (el.name) return el.name;
    if (el.dataset.clinifyKey) return el.dataset.clinifyKey;
    var key = 'ck-' + tag + '-' + idx;
    el.dataset.clinifyKey = key;
    return key;
  }

  // Serialize current state: all checkboxes, selects, text inputs, data-attrs
  function captureState() {
    var state = {};
    document.querySelectorAll('input[type=checkbox], input[type=radio]').forEach(function(el, i) {
      state[ensureKey(el, 'chk', i)] = el.checked;
    });
    document.querySelectorAll('select').forEach(function(el, i) {
      state[ensureKey(el, 'sel', i)] = el.value;
    });
    document.querySelectorAll('input[type=text], input[type=number], textarea').forEach(function(el, i) {
      state[ensureKey(el, 'txt', i)] = el.value;
    });
    document.querySelectorAll('[data-artifact-state]').forEach(function(el) {
      try { state[el.dataset.artifactState] = JSON.parse(el.dataset.artifactState); } catch(ex) {}
    });
    return state;
  }

  // Debounced change notifier
  var timer = null;
  function notify() {
    clearTimeout(timer);
    timer = setTimeout(function() {
      var state = captureState();
      window.parent.postMessage({ type: 'artifact:change', data: state }, '*');
    }, 300);
  }

  document.addEventListener('change', notify);
  document.addEventListener('input', notify);
  document.addEventListener('click', function(e) {
    if (e.target.closest('button, [role=button], .clickable, [onclick]')) {
      setTimeout(notify, 100);
    }
  });

  // Expose for custom artifacts that have their own state logic
  window.notifyChange = function(data) {
    window.parent.postMessage({ type: 'artifact:change', data: data || captureState() }, '*');
  };

  // Override loadState from artifact
  if (typeof window.loadState !== 'function') {
    window.loadState = function(data) {
      if (!data) return;
      Object.keys(data).forEach(function(key) {
        try {
          var el = document.getElementById(key)
            || document.getElementsByName(key)[0]
            || document.querySelector('[data-clinify-key="'+key+'"]')
            || document.querySelector('[data-artifact-state="'+key+'"]');
          if (el) {
            if (el.type === 'checkbox' || el.type === 'radio') { el.checked = data[key]; el.dispatchEvent(new Event('change', {bubbles:true})); }
            else if (el.tagName === 'SELECT') { el.value = data[key]; el.dispatchEvent(new Event('change', {bubbles:true})); }
            else el.value = data[key];
          }
        } catch(ex) {}
      });
    };
  }
})();
</script>`

export function ArtifactViewer({ type, data, readOnly = false, onDataChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch artifact HTML and inject postMessage script
  useEffect(() => {
    if (!type) return
    setLoading(true)
    setError(null)
    fetch(`/artifacts/${type}.html`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.text() })
      .then(html => {
        // Insert injected script before </body> or at the end
        if (html.includes('</body>')) {
          html = html.replace('</body>', INJECTED_SCRIPT + '</body>')
        } else {
          html += INJECTED_SCRIPT
        }
        setHtmlContent(html)
        setLoading(false)
      })
      .catch(err => { setError('Error al cargar el artefacto'); setLoading(false) })
  }, [type])

  // Fallback timeout
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3000)
    return () => clearTimeout(t)
  }, [type])

  const handleMessage = useCallback((e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return

    if (e.data.type === 'artifact:ready') {
      setLoading(false)
      if (readOnly && data) {
        iframeRef.current?.contentWindow?.postMessage({ type: 'artifact:load', data }, '*')
      }
    }

    if (e.data.type === 'artifact:change' && !readOnly) {
      onDataChange?.(e.data.data as Record<string, unknown>)
    }
  }, [readOnly, data, onDataChange])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  if (!type) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] text-[var(--subtle)]">
        Sin artefacto asignado para esta especialidad.
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)] rounded-[10px] z-10">
          <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {htmlContent && (
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          className={cn(
            'w-full border border-[var(--border)] rounded-[10px] bg-white',
            loading ? 'invisible' : 'visible'
          )}
          style={{ minHeight: 400 }}
          title={`Artefacto: ${type}`}
        />
      )}
    </div>
  )
}
