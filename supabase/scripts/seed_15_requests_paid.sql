-- ============================================================
-- Seed: 5 consultas + 5 exames + 5 receitas, todos status PAID
-- Para testes. SEMPRE usa usuários existentes (não cria fakes).
-- Pré-requisito: ao menos 1 paciente e 1 médico cadastrados.
--
-- IMPORTANTE: Para aparecer no app, faça login com a conta do paciente
-- usado aqui. Se v_patient_email = NULL, usa o 1º paciente do banco.
-- ============================================================

DO $$
DECLARE
  v_patient_email text := NULL;  -- Defina o email do paciente (ex: 'seu@email.com') para ver no app
  v_patient_id uuid;
  v_doctor_id uuid;
  v_patient_name text;
  v_doctor_name text;
  v_request_id uuid;
  i int;
  v_price decimal(10,2);
BEGIN
  -- Paciente: por email se definido, senão primeiro paciente
  IF v_patient_email IS NOT NULL AND v_patient_email != '' THEN
    SELECT id, name INTO v_patient_id, v_patient_name
    FROM public.users WHERE role = 'patient' AND email = v_patient_email LIMIT 1;
  END IF;
  IF v_patient_id IS NULL THEN
    SELECT id, name INTO v_patient_id, v_patient_name
    FROM public.users WHERE role = 'patient' ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id, name INTO v_doctor_id, v_doctor_name
  FROM public.users WHERE role = 'doctor' ORDER BY created_at LIMIT 1;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum paciente cadastrado. Cadastre um paciente antes de rodar o seed.';
  END IF;
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum médico cadastrado. Cadastre um médico antes de rodar o seed.';
  END IF;
  v_patient_name := COALESCE(v_patient_name, 'Paciente');
  v_doctor_name := COALESCE(v_doctor_name, 'Médico');

  -- 5 CONSULTAS (status paid)
  FOR i IN 1..5 LOOP
    v_price := 99.90 + (i * 10);
    INSERT INTO public.requests (
      patient_id, patient_name, doctor_id, doctor_name,
      request_type, status, symptoms, price, notes,
      consultation_type, contracted_minutes, price_per_minute,
      created_at, updated_at
    ) VALUES (
      v_patient_id, v_patient_name, v_doctor_id, v_doctor_name,
      'consultation', 'paid',
      'Consulta teste #' || i || ' - dor de cabeça, febre leve',
      v_price, 'Seed para testes',
      'medico_clinico', 15, 6.66,
      NOW() - (i * interval '2 hours'), NOW()
    )
    RETURNING id INTO v_request_id;

    INSERT INTO public.payments (request_id, user_id, amount, status, payment_method, paid_at, created_at, updated_at)
    VALUES (v_request_id, v_patient_id, v_price, 'approved', 'pix', NOW(), NOW(), NOW());
  END LOOP;

  -- 5 EXAMES (status paid)
  FOR i IN 1..5 LOOP
    v_price := 49.90 + (i * 5);
    INSERT INTO public.requests (
      patient_id, patient_name, doctor_id, doctor_name,
      request_type, status, symptoms, price, notes,
      exam_type, exams, exam_images,
      created_at, updated_at
    ) VALUES (
      v_patient_id, v_patient_name, v_doctor_id, v_doctor_name,
      'exam', 'paid',
      'Exame teste #' || i || ' - solicitação de laboratorial',
      v_price, 'Seed para testes',
      CASE i WHEN 1 THEN 'hemograma' WHEN 2 THEN 'glicemia' WHEN 3 THEN 'colesterol' WHEN 4 THEN 'tsh' ELSE 'creatinina' END,
      '[]'::jsonb, '[]'::jsonb,
      NOW() - (i * interval '3 hours'), NOW()
    )
    RETURNING id INTO v_request_id;

    INSERT INTO public.payments (request_id, user_id, amount, status, payment_method, paid_at, created_at, updated_at)
    VALUES (v_request_id, v_patient_id, v_price, 'approved', 'pix', NOW(), NOW(), NOW());
  END LOOP;

  -- 5 RECEITAS (status paid)
  FOR i IN 1..5 LOOP
    v_price := 29.90 + (i * 3);
    INSERT INTO public.requests (
      patient_id, patient_name, doctor_id, doctor_name,
      request_type, status, symptoms, price, notes,
      prescription_type, medications, prescription_images,
      created_at, updated_at
    ) VALUES (
      v_patient_id, v_patient_name, v_doctor_id, v_doctor_name,
      'prescription', 'paid',
      'Receita teste #' || i || ' - renovação de medicamento',
      v_price, 'Seed para testes',
      CASE i WHEN 1 THEN 'simple' WHEN 2 THEN 'controlled' WHEN 3 THEN 'simple' WHEN 4 THEN 'blue' ELSE 'simple' END,
      '[{"name":"Paracetamol 500mg","dosage":"1cp 6/6h"}]'::jsonb,
      '[]'::jsonb,
      NOW() - (i * interval '4 hours'), NOW()
    )
    RETURNING id INTO v_request_id;

    INSERT INTO public.payments (request_id, user_id, amount, status, payment_method, paid_at, created_at, updated_at)
    VALUES (v_request_id, v_patient_id, v_price, 'approved', 'pix', NOW(), NOW(), NOW());
  END LOOP;

  RAISE NOTICE 'Seed OK: 15 requests (5 consultas + 5 exames + 5 receitas) para paciente % (%). Faça login com essa conta no app.', v_patient_name, (SELECT email FROM public.users WHERE id = v_patient_id);
END $$;
