const fs = require('fs');
const file = 'C:\\Users\\renat\\source\\repos\\ola-jamal\\frontend-web\\src\\pages\\doctor\\DoctorRequestDetail.tsx';
let content = fs.readFileSync(file, 'utf8');
const old = `                    aiSuggestion={request.aiConductSuggestion}
                    onSaved={async () => { await refetch(); }}`;
const rep = `                    aiSuggestion={request.aiConductSuggestion}
                    anamnesisJson={request.consultationAnamnesis}
                    consultationTranscript={request.consultationTranscript}
                    consultationSuggestions={(() => {
                      try {
                        const parsed = JSON.parse(request.consultationAiSuggestions ?? '[]');
                        return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
                      } catch { return []; }
                    })()}
                    onSaved={async () => { await refetch(); }}`;
const count = (content.match(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`Found ${count} occurrence(s)`);
if (count === 1) {
  content = content.replace(old, rep);
  fs.writeFileSync(file, content, 'utf8');
  console.log('SUCCESS: File patched');
} else {
  console.log('ERROR: unexpected count, not patching');
}
