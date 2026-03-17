/* global URL, console */
// patch-detail.mjs - Run with: node patch-detail.mjs
import { readFileSync, writeFileSync } from 'fs';

const file = new URL('./DoctorRequestDetail.tsx', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
let content = readFileSync(file, 'utf8');

const old = `                    aiSuggestion={request.aiConductSuggestion}
                    onSaved={async () => { await refetch(); }}
                  />
                )}

                {/* Transcrição`;

const rep = `                    aiSuggestion={request.aiConductSuggestion}
                    anamnesisJson={request.consultationAnamnesis}
                    consultationTranscript={request.consultationTranscript}
                    consultationSuggestions={(() => {
                      try {
                        const parsed = JSON.parse(request.consultationAiSuggestions ?? '[]');
                        return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
                      } catch { return []; }
                    })()}
                    onSaved={async () => { await refetch(); }}
                  />
                )}

                {/* Transcrição`;

const count = content.split(old).length - 1;
console.log('Occurrences found:', count);

if (count === 1) {
  content = content.replace(old, rep);
  writeFileSync(file, content, 'utf8');
  console.log('SUCCESS: DoctorRequestDetail.tsx patched');
} else {
  console.log('ERROR: Expected 1 occurrence, found', count);
}
