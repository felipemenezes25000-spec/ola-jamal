/**
 * Referência CID-10 → medicamentos sugeridos (apoio ao médico).
 * Baseado em PCDT e práticas comuns. O médico deve validar a indicação.
 * Lista expandida com os CIDs mais frequentes em atenção primária.
 */
export interface CidMedicationItem {
  cid: string;
  description: string;
  medications: string[];
}

export const CID_MEDICATIONS: CidMedicationItem[] = [
  // Capítulo I - Infecções (A00-B99)
  { cid: 'A09', description: 'Diarreia e gastroenterite', medications: ['Racecadoril — 1 envelope 8/8h — 10 doses', 'Soro reidratação oral — conforme necessidade'] },
  { cid: 'A15', description: 'Tuberculose respiratória', medications: ['Rifampicina + Isoniazida + Pirazinamida — esquema conforme PCDT'] },
  { cid: 'B34.9', description: 'Infecção viral não especificada', medications: ['Paracetamol 750mg — 1cp 6/6h — 20 comprimidos', 'Repouso e hidratação'] },
  { cid: 'B35', description: 'Dermatofitose (micose)', medications: ['Cetoconazol 2% creme — 2x/dia na lesão — 1 bisnaga', 'Terbinafina 250mg — 1cp ao dia — 14 comprimidos'] },
  // Capítulo II - Neoplasias (C00-D48) - tratamentos específicos, listar exemplos
  // Capítulo III - Sangue (D50-D89)
  { cid: 'D50', description: 'Anemia ferropriva', medications: ['Sulfato ferroso 300mg — 1cp em jejum — 60 comprimidos', 'Vitamina C 500mg — junto ao ferro — 60 comprimidos'] },
  { cid: 'D64.9', description: 'Anemia não especificada', medications: ['Sulfato ferroso 300mg — 1cp em jejum — 60 comprimidos', 'Ácido fólico 5mg — 1cp ao dia — 60 comprimidos'] },
  // Capítulo IV - Endocrinológicas (E00-E90)
  { cid: 'E11', description: 'Diabetes tipo 2', medications: ['Metformina 850mg — 1cp 12/12h — 60 comprimidos', 'Controle glicêmico e dieta'] },
  { cid: 'E78', description: 'Dislipidemia', medications: ['Sinvastatina 20mg — 1cp à noite — 30 comprimidos', 'Dieta e exercícios'] },
  { cid: 'E66', description: 'Obesidade', medications: ['Orientações dietéticas e atividade física', 'Orlistate 120mg — 1cp nas refeições — 42 cápsulas (se indicado)'] },
  // Capítulo V - Transtornos mentais (F00-F99)
  { cid: 'F32', description: 'Episódio depressivo', medications: ['Sertralina 50mg — 1cp pela manhã — 30 comprimidos', 'Fluoxetina 20mg — 1cp pela manhã — 30 comprimidos'] },
  { cid: 'F41', description: 'Transtornos ansiosos', medications: ['Escitalopram 10mg — 1cp ao dia — 30 comprimidos', 'Clonazepam 0,5mg — 1cp à noite se necessário — 30 comprimidos'] },
  { cid: 'F51', description: 'Transtornos do sono', medications: ['Higiene do sono', 'Melatonina 3mg — 1cp 30min antes de dormir — 30 comprimidos'] },
  { cid: 'G43', description: 'Enxaqueca', medications: ['Dipirona 500mg — 2cp ao iniciar crise — 20 comprimidos', 'Naproxeno 550mg — 1cp 12/12h se dor — 20 comprimidos'] },
  { cid: 'G47', description: 'Distúrbios do sono', medications: ['Melatonina 3mg — 1cp 30min antes de dormir — 30 comprimidos', 'Zolpidem 10mg — 1cp ao deitar (uso pontual) — 10 comprimidos'] },
  // Capítulo VI - Nervoso (G00-G99)
  { cid: 'G44', description: 'Cefaleia tensional', medications: ['Dipirona 500mg — 1cp 6/6h — 20 comprimidos', 'Paracetamol 750mg — 1cp 6/6h — 20 comprimidos'] },
  { cid: 'G47.3', description: 'Apneia do sono', medications: ['Encaminhar polissonografia', 'Orientações: posição lateral, perda de peso'] },
  // Capítulo VII - Olho (H00-H59)
  { cid: 'H10', description: 'Conjuntivite', medications: ['Colírio dexametasona+neomicina — 1-2 gotas 4x/dia — 10ml', 'Loratadina 10mg — 1cp ao dia se prurido — 10 comprimidos'] },
  { cid: 'H66', description: 'Otite média', medications: ['Amoxicilina 500mg — 1cp 8/8h — 21 comprimidos', 'Dipirona 500mg — 1cp 6/6h se dor — 20 comprimidos'] },
  // Capítulo VIII - Ouvido (H60-H95)
  // Capítulo IX - Circulatório (I00-I99)
  { cid: 'I10', description: 'Hipertensão essencial', medications: ['Losartana 50mg — 1cp pela manhã — 30 comprimidos', 'Anlodipino 5mg — 1cp ao dia — 30 comprimidos'] },
  { cid: 'I25', description: 'Doença arterial coronariana', medications: ['AAS 100mg — 1cp ao dia — 30 comprimidos', 'Encaminhar cardiologia'] },
  // Capítulo X - Respiratório (J00-J99)
  { cid: 'J00', description: 'Resfriado comum', medications: ['Paracetamol 750mg — 1cp 6/6h — 20 comprimidos', 'Dipirona 500mg — 1cp 6/6h se febre — 20 comprimidos'] },
  { cid: 'J02', description: 'Faringite aguda', medications: ['Amoxicilina 500mg — 1cp 8/8h — 21 comprimidos', 'Paracetamol 750mg — 1cp 6/6h — 20 comprimidos'] },
  { cid: 'J03', description: 'Amigdalite', medications: ['Amoxicilina 500mg — 1cp 8/8h — 21 comprimidos', 'Dipirona 500mg — 1cp 6/6h — 20 comprimidos'] },
  { cid: 'J06.9', description: 'IVAS (infecção respiratória aguda)', medications: ['Paracetamol 750mg — 1cp 6/6h — 20 comprimidos', 'Dipirona 500mg — 1cp 6/6h se febre — 20 comprimidos'] },
  { cid: 'J20', description: 'Bronquite aguda', medications: ['Amoxicilina 500mg — 1cp 8/8h — 21 comprimidos', 'Bromexina 8mg — 1cp 8/8h — 30 comprimidos'] },
  { cid: 'J30', description: 'Rinite alérgica', medications: ['Loratadina 10mg — 1cp ao dia — 30 comprimidos', 'Desloratadina 5mg — 1cp ao dia — 30 comprimidos'] },
  { cid: 'J31', description: 'Rinite crônica', medications: ['Mometasona nasal — 2 aplicações 1x/dia — 1 frasco', 'Loratadina 10mg — 1cp ao dia — 30 comprimidos'] },
  { cid: 'J32', description: 'Sinusite crônica', medications: ['Amoxicilina 500mg — 1cp 8/8h — 21 comprimidos', 'Mometasona nasal — 2 aplicações 1x/dia — 1 frasco'] },
  { cid: 'J45', description: 'Asma', medications: ['Budesonida + formoterol inalatório — conforme orientação', 'Salbutamol spray — uso sob demanda'] },
  // Capítulo XI - Digestivo (K00-K93)
  { cid: 'K21', description: 'Doença do refluxo gastroesofágico', medications: ['Omeprazol 20mg — 1cp em jejum — 30 comprimidos', 'Evitar deitar após refeições'] },
  { cid: 'K29', description: 'Gastrite', medications: ['Omeprazol 20mg — 1cp em jejum — 30 comprimidos', 'Ranitidina 150mg — 1cp 12/12h — 30 comprimidos'] },
  { cid: 'K30', description: 'Dispepsia funcional', medications: ['Omeprazol 20mg — 1cp em jejum — 30 comprimidos', 'Domperidona 10mg — 1cp 8/8h 15min antes — 30 comprimidos'] },
  { cid: 'K59.1', description: 'Diarreia funcional', medications: ['Racecadoril — 1 envelope 8/8h — 10 doses', 'Probióticos — 1 cápsula ao dia — 30 dias'] },
  { cid: 'K80', description: 'Colelitíase', medications: ['Analgesia conforme dor', 'Encaminhar cirurgia'] },
  // Capítulo XII - Pele (L00-L99)
  { cid: 'L20', description: 'Dermatite atópica', medications: ['Hidrocortisona 1% creme — 2x/dia na lesão — 1 bisnaga', 'Hidratante corporal — uso diário'] },
  { cid: 'L23', description: 'Dermatite de contato', medications: ['Hidrocortisona 1% creme — 2x/dia na lesão — 1 bisnaga', 'Loratadina 10mg — 1cp ao dia — 30 comprimidos'] },
  { cid: 'L30', description: 'Dermatite', medications: ['Hidrocortisona 1% creme — 2x/dia na lesão — 1 bisnaga', 'Cetirizina 10mg — 1cp ao dia — 30 comprimidos'] },
  { cid: 'L50', description: 'Urticária', medications: ['Loratadina 10mg — 1cp ao dia — 30 comprimidos', 'Desloratadina 5mg — 1cp ao dia — 30 comprimidos'] },
  { cid: 'L70', description: 'Acne', medications: ['Peróxido de benzoíla 5% gel — 1x/dia — 1 bisnaga', 'Adapaleno 0,1% gel — 1x/noite — 1 bisnaga'] },
  { cid: 'L71', description: 'Rosácea', medications: ['Metronidazol 0,75% gel — 2x/dia — 1 bisnaga', 'Proteção solar'] },
  // Capítulo XIII - Músculo-esquelético (M00-M99)
  { cid: 'M25.5', description: 'Dor articular', medications: ['Diclofenaco 50mg — 1cp 8/8h — 30 comprimidos', 'Ibuprofeno 600mg — 1cp 8/8h — 20 comprimidos'] },
  { cid: 'M54', description: 'Dor lombar', medications: ['Diclofenaco 50mg — 1cp 8/8h — 30 comprimidos', 'Musculare 300mg — 1cp 8/8h — 20 comprimidos'] },
  { cid: 'M79.1', description: 'Mialgia', medications: ['Diclofenaco 50mg — 1cp 8/8h — 30 comprimidos', 'Dipirona 500mg — 1cp 6/6h — 20 comprimidos'] },
  { cid: 'M17', description: 'Gonartrose', medications: ['Paracetamol 750mg — 1cp 6/6h — 60 comprimidos', 'Condroitina + glicosamina — conforme orientação'] },
  { cid: 'M81', description: 'Osteoporose', medications: ['Cálcio + vitamina D — 1cp ao dia — 60 comprimidos', 'Encaminhar reumatologia'] },
  // Capítulo XIV - Geniturinário (N00-N99)
  { cid: 'N39', description: 'Infecção urinária', medications: ['Nitrofurantoína 100mg — 1cp 6/6h — 20 comprimidos', 'Ciprofloxacino 500mg — 1cp 12/12h — 14 comprimidos'] },
  { cid: 'N30', description: 'Cistite', medications: ['Nitrofurantoína 100mg — 1cp 6/6h — 20 comprimidos', 'Hidratação'] },
  // Capítulo XVIII - Sintomas (R00-R99)
  { cid: 'R10', description: 'Dor abdominal', medications: ['Buscopan 10mg — 1cp 8/8h se cólica — 20 comprimidos', 'Paracetamol 750mg — 1cp 6/6h — 20 comprimidos'] },
  { cid: 'R51', description: 'Cefaleia', medications: ['Dipirona 500mg — 1cp 6/6h — 20 comprimidos', 'Paracetamol 750mg — 1cp 6/6h — 20 comprimidos'] },
  { cid: 'R52', description: 'Dor não classificada', medications: ['Dipirona 500mg — 1cp 6/6h — 20 comprimidos', 'Paracetamol 750mg — 1cp 6/6h — 20 comprimidos'] },
  { cid: 'R11', description: 'Náusea e vômitos', medications: ['Metoclopramida 10mg — 1cp 8/8h — 20 comprimidos', 'Ondansetrona 4mg — 1cp 8/8h se necessário — 10 comprimidos'] },
  { cid: 'R05', description: 'Tosse', medications: ['Bromexina 8mg — 1cp 8/8h — 30 comprimidos', 'Dexametasona 0,5mg — 1cp 12/12h (curto prazo) — 20 comprimidos'] },
  { cid: 'R00.0', description: 'Taquicardia', medications: ['Avaliar causa', 'Propranolol 40mg — 1cp 12/12h se indicado — 30 comprimidos'] },
  { cid: 'R53', description: 'Astenia', medications: ['Investigar causa', 'Complexo B — 1cp ao dia — 30 comprimidos'] },
  { cid: 'R19.0', description: 'Edema', medications: ['Investigar causa', 'Furosemida 40mg — 1cp em jejum (se indicado) — 30 comprimidos'] },
  // Capítulo II - Neoplasias (exemplos)
  { cid: 'C50', description: 'Neoplasia de mama', medications: ['Encaminhar oncologia', 'Analgesia conforme sintomas'] },
  { cid: 'C61', description: 'Neoplasia de próstata', medications: ['Encaminhar urologia', 'Analgesia conforme sintomas'] },
  { cid: 'C34', description: 'Neoplasia de pulmão', medications: ['Encaminhar pneumologia/oncologia', 'Oximetria e suporte'] },
  { cid: 'C18', description: 'Neoplasia de cólon', medications: ['Encaminhar coloproctologia', 'Laxantes conforme necessidade'] },
  { cid: 'C25', description: 'Neoplasia de pâncreas', medications: ['Encaminhar oncologia', 'Enzimas pancreáticas se insuficiência'] },
  // Capítulo IV - Mais endócrinas
  { cid: 'E66.0', description: 'Obesidade por excesso de calorias', medications: ['Orlistate 120mg — 1cp nas refeições — 42 cápsulas', 'Metformina 500mg — 1cp 12/12h (se indicado)'] },
  { cid: 'E05', description: 'Tireotoxicose', medications: ['Encaminhar endocrinologia', 'Propranolol 40mg — 1cp 8/8h (sintomático) — 30 comprimidos'] },
  { cid: 'E03', description: 'Hipotireoidismo', medications: ['Encaminhar endocrinologia', 'Levotiroxina — dose conforme TSH'] },
  { cid: 'E78.0', description: 'Hipercolesterolemia pura', medications: ['Sinvastatina 20mg — 1cp à noite — 30 comprimidos', 'Rosuvastatina 10mg — 1cp ao dia — 30 comprimidos'] },
  { cid: 'E78.2', description: 'Hiperlipidemia mista', medications: ['Sinvastatina 20mg — 1cp à noite — 30 comprimidos', 'Atorvastatina 10mg — 1cp à noite — 30 comprimidos'] },
  // Capítulo V - Mais transtornos mentais
  { cid: 'F20', description: 'Esquizofrenia', medications: ['Encaminhar psiquiatria', 'Risperidona — dose conforme prescrição'] },
  { cid: 'F31', description: 'Transtorno afetivo bipolar', medications: ['Encaminhar psiquiatria', 'Lítio — dose conforme nível sérico'] },
  { cid: 'F40', description: 'Transtornos fóbicos', medications: ['Escitalopram 10mg — 1cp ao dia — 30 comprimidos', 'Encaminhar psicoterapia'] },
  { cid: 'F33', description: 'Transtorno depressivo recorrente', medications: ['Sertralina 50mg — 1cp pela manhã — 60 comprimidos', 'Acompanhamento psicológico'] },
  { cid: 'F48.0', description: 'Neurastenia', medications: ['Escitalopram 10mg — 1cp ao dia — 30 comprimidos', 'Completo B — 1cp ao dia'] },
  // Capítulo VI - Mais neurológicas
  { cid: 'G40', description: 'Epilepsia', medications: ['Encaminhar neurologia', 'Ácido valproico — dose conforme prescrição'] },
  { cid: 'G35', description: 'Esclerose múltipla', medications: ['Encaminhar neurologia', 'Vitamina D — suplementação'] },
  { cid: 'G56', description: 'Mononeuropatia membro superior', medications: ['Diclofenaco 50mg — 1cp 8/8h — 20 comprimidos', 'Vitamina B12 — 1cp ao dia'] },
  { cid: 'G57', description: 'Mononeuropatia membro inferior', medications: ['Pregabalina 75mg — 1cp à noite — 30 comprimidos', 'Vitamina B12'] },
  { cid: 'G89', description: 'Dor não classificada', medications: ['Paracetamol 750mg — 1cp 6/6h — 30 comprimidos', 'Tramadol 50mg — 1cp 8/8h se necessário'] },
  // Capítulo X - Mais respiratórias
  { cid: 'J18', description: 'Pneumonia não especificada', medications: ['Amoxicilina 500mg — 1cp 8/8h — 21 comprimidos', 'Azitromicina 500mg — 1cp ao dia — 3 dias'] },
  { cid: 'J40', description: 'Bronquite não especificada', medications: ['Amoxicilina 500mg — 1cp 8/8h — 21 comprimidos', 'Bromexina 8mg — 1cp 8/8h — 30 comprimidos'] },
  { cid: 'J44', description: 'DPOC', medications: ['Budesonida + formoterol inalatório — conforme orientação', 'Salbutamol spray — uso sob demanda'] },
  { cid: 'J36', description: 'Abscesso periamigdaliano', medications: ['Amoxicilina + clavulanato 875+125mg — 1cp 12/12h — 14 comprimidos', 'Dexametasona 4mg — 1cp ao dia — 3 dias'] },
  { cid: 'J34', description: 'Outros transtornos do nariz', medications: ['Mometasona nasal — 2 aplicações 1x/dia', 'Loratadina 10mg — 1cp ao dia'] },
  // Capítulo XI - Mais digestivas
  { cid: 'K35', description: 'Apendicite aguda', medications: ['Encaminhar cirurgia', 'Analgesia pré-operatória conforme protocolo'] },
  { cid: 'K57', description: 'Doença diverticular', medications: ['Rifaximina 400mg — 1cp 8/8h — 7 dias', 'Fibras e hidratação'] },
  { cid: 'K58', description: 'Síndrome do intestino irritável', medications: ['Hioscina 10mg — 1cp 8/8h se cólica — 20 comprimidos', 'Fibras solúveis'] },
  { cid: 'K91', description: 'Transtornos pós-procedimento digestivo', medications: ['Omeprazol 20mg — 1cp em jejum — 30 comprimidos', 'Metoclopramida 10mg — 1cp 8/8h se náusea'] },
  { cid: 'K02', description: 'Cárie dental', medications: ['Encaminhar odontologia', 'Paracetamol 750mg — 1cp 6/6h se dor'] },
  // Capítulo XII - Mais dermatológicas
  { cid: 'L08', description: 'Outras infecções de pele', medications: ['Cefalexina 500mg — 1cp 6/6h — 10 dias', 'Mupirocina 2% pomada — 3x/dia na lesão'] },
  { cid: 'L40', description: 'Psoríase', medications: ['Betametasona + ácido salicílico pomada — 2x/dia — 1 bisnaga', 'Encaminhar dermatologia'] },
  { cid: 'L89', description: 'Úlcera de decúbito', medications: ['Cobertura com hidrocolóide', 'Cefalexina 500mg — 1cp 6/6h se infecção'] },
  { cid: 'L03', description: 'Celulite', medications: ['Cefalexina 500mg — 1cp 6/6h — 10 dias', 'Elevação do membro'] },
  { cid: 'L98', description: 'Outros transtornos da pele', medications: ['Hidrocortisona 1% creme — 2x/dia', 'Hidratante'] },
  // Capítulo XIII - Mais osteomusculares
  { cid: 'M06', description: 'Artrite reumatoide', medications: ['Encaminhar reumatologia', 'Metotrexato — dose conforme prescrição'] },
  { cid: 'M15', description: 'Poliartrose', medications: ['Paracetamol 750mg — 1cp 6/6h — 60 comprimidos', 'Condroitina + glicosamina'] },
  { cid: 'M23', description: 'Transtornos internos do joelho', medications: ['Diclofenaco 50mg — 1cp 8/8h — 20 comprimidos', 'Fisioterapia'] },
  { cid: 'M60', description: 'Miosite', medications: ['Diclofenaco 50mg — 1cp 8/8h — 20 comprimidos', 'Repouso'] },
  { cid: 'M75', description: 'Transtornos do ombro', medications: ['Diclofenaco 50mg — 1cp 8/8h — 20 comprimidos', 'Fisioterapia'] },
  // Capítulo XIV - Mais geniturinárias
  { cid: 'N28', description: 'Outros transtornos do rim', medications: ['Encaminhar nefrologia', 'Controle de PA e glicemia'] },
  { cid: 'N40', description: 'Hiperplasia da próstata', medications: ['Tansulosina 0,4mg — 1cp ao dia — 30 comprimidos', 'Finasterida 5mg — 1cp ao dia (se indicado)'] },
  { cid: 'N76', description: 'Outras afecções vaginais', medications: ['Metronidazol 400mg — 1cp 12/12h — 7 dias', 'Clotrimazol creme vaginal — 7 dias'] },
  { cid: 'N91', description: 'Transtornos menstruais', medications: ['Ácido tranexâmico 500mg — 1cp 8/8h nos dias de fluxo', 'Encaminhar ginecologia'] },
  { cid: 'N94', description: 'Transtornos dolorosos femininos', medications: ['Ibuprofeno 600mg — 1cp 8/8h se dor — 20 comprimidos', 'Anticoncepcional (se indicado)'] },
  // Capítulo XV - Gravidez
  { cid: 'O14', description: 'Pré-eclâmpsia', medications: ['Encaminhar urgência obstétrica', 'Sulfato de magnésio conforme protocolo'] },
  { cid: 'O99', description: 'Outras doenças na gravidez', medications: ['Encaminhar obstetrícia', 'Ácido fólico 5mg — 1cp ao dia'] },
  // Capítulo XVII - Congênitas (exemplos)
  { cid: 'Q21', description: 'Cardiopatia congênita', medications: ['Encaminhar cardiologia infantil', 'Profilaxia endocardite se indicado'] },
  { cid: 'Q90', description: 'Síndrome de Down', medications: ['Acompanhamento multidisciplinar', 'Suplementos conforme necessidade'] },
  // Capítulo XIX - Traumatismos
  { cid: 'S00', description: 'Traumatismo superficial da cabeça', medications: ['Paracetamol 750mg — 1cp 6/6h — 20 comprimidos', 'Curativo conforme lesão'] },
  { cid: 'S52', description: 'Fratura de antebraço', medications: ['Imobilização', 'Diclofenaco 50mg — 1cp 8/8h — 20 comprimidos'] },
  { cid: 'S83', description: 'Traumatismo do joelho', medications: ['Imobilização', 'Diclofenaco 50mg — 1cp 8/8h — 20 comprimidos'] },
  { cid: 'T14', description: 'Traumatismo região não especificada', medications: ['Paracetamol 750mg — 1cp 6/6h — 20 comprimidos', 'Avaliação conforme mecanismo'] },
  // Capítulo XX - Causas externas (apenas referência)
  { cid: 'Z00', description: 'Exame geral de rotina', medications: ['Solicitar exames conforme protocolo', 'Orientações de prevenção'] },
  { cid: 'Z23', description: 'Consulta para imunização', medications: ['Vacinas conforme calendário', 'Antitérmico profilático se necessário'] },
  { cid: 'Z34', description: 'Supervisão de gravidez normal', medications: ['Ácido fólico 5mg — 1cp ao dia', 'Sulfato ferroso 300mg — 1cp em jejum'] },
  { cid: 'Z71', description: 'Consulta para orientação', medications: ['Orientações conforme queixa', 'Encaminhamento se necessário'] },
  { cid: 'Z79', description: 'Uso prolongado de medicamentos', medications: ['Manutenção conforme prescrição anterior', 'Reavaliação periódica'] },
];

export function searchCid(query: string): CidMedicationItem[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];
  return CID_MEDICATIONS.filter(
    (c) =>
      c.cid.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.medications.some((m) => m.toLowerCase().includes(q))
  ).slice(0, 20);
}

export function getAllCids(): CidMedicationItem[] {
  return [...CID_MEDICATIONS];
}
