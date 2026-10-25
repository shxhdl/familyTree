-- ============================================================
-- SEED SCRIPT: شجرة عائلة الشيخ علي عيسى الزدجالي
-- ============================================================

DO $$
DECLARE
  v_tree_id UUID;

  -- Root & Wives
  p_ali UUID;
  w_asha UUID;
  w_saliha UUID;
  w_mahdim UUID;
  w_husseina UUID;

  -- W1: عشه عيالها
  c_abdullah UUID;
  c_ahmed1 UUID;
  c_salah UUID;
  c_nasser UUID;
  c_safiya UUID;

  -- Abdullah branch
  c_saeed_ab UUID;
  c_hilal_ab UUID;
  c_mahfouz_ab UUID;
  c_hanifa UUID;
  c_shaikha UUID;
  c_shamsa_ab UUID;
  c_zakiya UUID;

  -- Nasser branch
  c_anwar_nas UUID;

  -- Safiya branch
  c_faiza_saf UUID;

  -- W2: صالحه عيالها
  c_saud UUID;
  c_mohammed_sal UUID;
  c_hilal_sal UUID;
  c_fatima_sal UUID;
  c_zamzam UUID;
  c_mahfouza_sal UUID;

  -- Saud branch
  c_muneera_saud UUID;
  c_muna_saud UUID;

  -- Mohammed branch
  c_buthaina UUID;

  -- Hilal branch
  c_waleed UUID;
  c_eiman_hilal UUID;
  c_abdulaziz_hilal UUID;
  c_maha_hilal UUID;
  c_shuaa_hilal UUID;

  -- Fatima branch
  c_abdulrahman_fat UUID;
  c_maryam_fat UUID;
  c_amina_fat UUID;

  -- Zamzam branch
  c_talal_zam UUID;
  c_arwa_talal UUID;
  c_areej_talal UUID;
  c_mohammed_talal UUID;
  c_anwar_zam UUID;
  c_khadija_anwar UUID;
  c_ali_zam UUID;
  c_qais_zam UUID;
  c_zainab_qais UUID;
  c_fathiya_zam UUID;
  c_mohammed_fath UUID;
  c_abdullah_fath UUID;
  c_ibrahim_fath UUID;
  c_fatima_fath UUID;
  c_amal_zam UUID;

  -- Mahfouza branch
  c_bushra_mah UUID;
  c_khadija_mah UUID;

  -- W3: مهديم عيالها
  c_abdullatif UUID;
  c_khalid_mah UUID;
  c_mahmoud_mah UUID;
  c_sameer UUID;
  c_saeed_mah UUID;
  c_zubaida UUID;
  c_maryam_mah UUID;

  -- W4: حسينه عيالها
  c_salem UUID;

  -- helper
  tmp_id UUID;

  -- Helper function inside block logic:
  -- We'll insert and link to family_tree_members immediately.

BEGIN
  -- 1. Identify the tree (either the created tree or matching name)
  SELECT id INTO v_tree_id
  FROM public.family_trees
  WHERE id = '26a1072a-cd96-46e5-86c5-458b2ab87603'::UUID
  LIMIT 1;

  IF v_tree_id IS NULL THEN
    SELECT id INTO v_tree_id
    FROM public.family_trees
    WHERE name_ar LIKE '%علي عيسى%'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_tree_id IS NULL THEN
    SELECT id INTO v_tree_id FROM public.family_trees ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- ============================================================
  -- الجد الأكبر: الشيخ علي عيسى الزدجالي (الجيل الأول)
  -- ============================================================
  INSERT INTO public.persons (full_name_ar, gender, is_alive)
  VALUES ('الشيخ علي عيسى الزدجالي', 'male', false)
  RETURNING id INTO p_ali;

  INSERT INTO public.family_tree_members (tree_id, person_id, is_root)
  VALUES (v_tree_id, p_ali, true);

  -- ============================================================
  -- الزوجات الأربع
  -- ============================================================
  -- الزوجة ١: عشه سيف الوهيبي
  INSERT INTO public.persons (full_name_ar, gender, spouse_id, is_alive)
  VALUES ('عشه سيف الوهيبي', 'female', p_ali, false)
  RETURNING id INTO w_asha;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, w_asha);

  -- الزوجة ٢: صالحه عمر ميران الزدجالي
  INSERT INTO public.persons (full_name_ar, gender, spouse_id, is_alive)
  VALUES ('صالحه عمر ميران الزدجالي', 'female', p_ali, false)
  RETURNING id INTO w_saliha;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, w_saliha);

  -- الزوجة ٣: مهديم محمد سيف البلوشي
  INSERT INTO public.persons (full_name_ar, gender, spouse_id, is_alive)
  VALUES ('مهديم محمد سيف البلوشي', 'female', p_ali, false)
  RETURNING id INTO w_mahdim;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, w_mahdim);

  -- الزوجة ٤: حسينه
  INSERT INTO public.persons (full_name_ar, gender, spouse_id, is_alive)
  VALUES ('حسينه', 'female', p_ali, false)
  RETURNING id INTO w_husseina;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, w_husseina);


  -- ============================================================
  -- فرع الزوجة ١: عشه سيف الوهيبي
  -- عيالها: عبدالله، احمد، صلاح، ناصر، صفيه
  -- ============================================================
  -- 1. عبدالله
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('عبدالله بن علي الزدجالي', 'male', p_ali, w_asha) RETURNING id INTO c_abdullah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_abdullah);

  -- عيال عبدالله: سعيد، هلال، محفوظ، حنيفه، شيخوه، شمسه، زكيه
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('سعيد بن عبدالله', 'male', c_abdullah) RETURNING id INTO c_saeed_ab;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_saeed_ab);
  -- عيال سعيد: نادر، احمد، محمد، نهى، سعاد، ميثه
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('نادر بن سعيد', 'male', c_saeed_ab),
    ('أحمد بن سعيد', 'male', c_saeed_ab),
    ('محمد بن سعيد', 'male', c_saeed_ab),
    ('نهى بنت سعيد', 'female', c_saeed_ab),
    ('سعاد بنت سعيد', 'female', c_saeed_ab),
    ('ميثه بنت سعيد', 'female', c_saeed_ab);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_saeed_ab;

  -- هلال بن عبدالله
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('هلال بن عبدالله', 'male', c_abdullah) RETURNING id INTO c_hilal_ab;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_hilal_ab);
  -- عيال هلال: بدر، خالد، احمد، محمد
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('بدر بن هلال', 'male', c_hilal_ab),
    ('خالد بن هلال', 'male', c_hilal_ab),
    ('أحمد بن هلال', 'male', c_hilal_ab),
    ('محمد بن هلال', 'male', c_hilal_ab);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_hilal_ab;

  -- محفوظ بن عبدالله
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('محفوظ بن عبدالله', 'male', c_abdullah) RETURNING id INTO c_mahfouz_ab;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_mahfouz_ab);
  -- عيال محفوظ: عبادي، خلود، مريم
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('عبادي بن محفوظ', 'male', c_mahfouz_ab),
    ('خلود بنت محفوظ', 'female', c_mahfouz_ab),
    ('مريم بنت محفوظ', 'female', c_mahfouz_ab);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_mahfouz_ab;

  -- حنيفه بنت عبدالله
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('حنيفه بنت عبدالله', 'female', c_abdullah) RETURNING id INTO c_hanifa;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_hanifa);
  -- عيال حنيفه: بدريه، فوزيه، خالد
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('بدريه', 'female', c_hanifa),
    ('فوزيه', 'female', c_hanifa),
    ('خالد', 'male', c_hanifa);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_hanifa;

  -- شيخوه بنت عبدالله
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('شيخوه بنت عبدالله', 'female', c_abdullah) RETURNING id INTO c_shaikha;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_shaikha);
  -- عيال شيخوه: سامي، امل
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('سامي', 'male', c_shaikha),
    ('أمل', 'female', c_shaikha);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_shaikha;

  -- شمسه بنت عبدالله
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('شمسه بنت عبدالله', 'female', c_abdullah) RETURNING id INTO c_shamsa_ab;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_shamsa_ab);
  -- عيال شمسه: ياسر، احمد، يمنى، يسرى، شيماء
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('ياسر', 'male', c_shamsa_ab),
    ('أحمد', 'male', c_shamsa_ab),
    ('يمنى', 'female', c_shamsa_ab),
    ('يسرى', 'female', c_shamsa_ab),
    ('شيماء', 'female', c_shamsa_ab);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_shamsa_ab;

  -- زكيه بنت عبدالله
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('زكيه بنت عبدالله', 'female', c_abdullah) RETURNING id INTO c_zakiya;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_zakiya);
  -- عيال زكيه: بدر، ناصر، بدريه، مريم، اميره، منيره، عبير
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('بدر', 'male', c_zakiya),
    ('ناصر', 'male', c_zakiya),
    ('بدريه', 'female', c_zakiya),
    ('مريم', 'female', c_zakiya),
    ('أميره', 'female', c_zakiya),
    ('منيره', 'female', c_zakiya),
    ('عبير', 'female', c_zakiya);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_zakiya;

  -- 2. احمد بن علي (أمه عشه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('أحمد بن علي الزدجالي', 'male', p_ali, w_asha) RETURNING id INTO c_ahmed1;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_ahmed1);
  -- عيال احمد: منير، نبيل، امين، محمود، زينب، مريم، نوره، محفوظه
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('منير بن أحمد', 'male', c_ahmed1),
    ('نبيل بن أحمد', 'male', c_ahmed1),
    ('أمين بن أحمد', 'male', c_ahmed1),
    ('محمود بن أحمد', 'male', c_ahmed1),
    ('زينب بنت أحمد', 'female', c_ahmed1),
    ('مريم بنت أحمد', 'female', c_ahmed1),
    ('نوره بنت أحمد', 'female', c_ahmed1),
    ('محفوظه بنت أحمد', 'female', c_ahmed1);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_ahmed1;

  -- 3. صلاح بن علي (أمه عشه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('صلاح بن علي الزدجالي', 'male', p_ali, w_asha) RETURNING id INTO c_salah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_salah);
  -- عيال صلاح: سعيد، محفوظ، محمد، علي، فيصل، فوزيه، فريده، حنان، ايمان، امينه
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('سعيد بن صلاح', 'male', c_salah),
    ('محفوظ بن صلاح', 'male', c_salah),
    ('محمد بن صلاح', 'male', c_salah),
    ('علي بن صلاح', 'male', c_salah),
    ('فيصل بن صلاح', 'male', c_salah),
    ('فوزيه بنت صلاح', 'female', c_salah),
    ('فريده بنت صلاح', 'female', c_salah),
    ('حنان بنت صلاح', 'female', c_salah),
    ('إيمان بنت صلاح', 'female', c_salah),
    ('أمينه بنت صلاح', 'female', c_salah);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_salah;

  -- 4. ناصر بن علي (أمه عشه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('ناصر بن علي الزدجالي', 'male', p_ali, w_asha) RETURNING id INTO c_nasser;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_nasser);
  -- عيال ناصر: انور، رشيد، حميده، فوزيه، نعيمه، انيسه، رقيه
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('أنور بن ناصر', 'male', c_nasser) RETURNING id INTO c_anwar_nas;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_anwar_nas);
  -- عيال انور: ساره، دينا، ماريا، نور
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('ساره بنت أنور', 'female', c_anwar_nas),
    ('دينا بنت أنور', 'female', c_anwar_nas),
    ('ماريا بنت أنور', 'female', c_anwar_nas),
    ('نور بنت أنور', 'female', c_anwar_nas);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_anwar_nas;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('رشيد بن ناصر', 'male', c_nasser),
    ('حميده بنت ناصر', 'female', c_nasser),
    ('فوزيه بنت ناصر', 'female', c_nasser),
    ('نعيمه بنت ناصر', 'female', c_nasser),
    ('أنيسه بنت ناصر', 'female', c_nasser),
    ('رقيه بنت ناصر', 'female', c_nasser);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_nasser AND id != c_anwar_nas;

  -- 5. صفيه بنت علي (أمها عشه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('صفيه بنت علي الزدجالي', 'female', p_ali, w_asha) RETURNING id INTO c_safiya;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_safiya);
  -- عيال صفيه: سيف، يونس، علي، فايزه، شفيقه، امينه
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('فايزه', 'female', c_safiya) RETURNING id INTO c_faiza_saf;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_faiza_saf);
  -- عيال فايزه: احمد، ابراهيم، عبدالرحمن، صفيه، بشاير
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('أحمد', 'male', c_faiza_saf),
    ('إبراهيم', 'male', c_faiza_saf),
    ('عبدالرحمن', 'male', c_faiza_saf),
    ('صفيه', 'female', c_faiza_saf),
    ('بشاير', 'female', c_faiza_saf);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_faiza_saf;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('سيف', 'male', c_safiya),
    ('يونس', 'male', c_safiya),
    ('علي', 'male', c_safiya),
    ('شفيقه', 'female', c_safiya),
    ('أمينه', 'female', c_safiya);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_safiya AND id != c_faiza_saf;


  -- ============================================================
  -- فرع الزوجة ٢: صالحه عمر ميران الزدجالي
  -- عيالها: سعود، محمد، هلال، فاطمه، زمزم، محفوظه
  -- ============================================================
  -- 1. سعود
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('سعود بن علي الزدجالي', 'male', p_ali, w_saliha) RETURNING id INTO c_saud;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_saud);

  -- عيال سعود: عادل، نبيل، طارق، علي، منيره، انيسه، خديجه، منى، امل
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('منيره بنت سعود', 'female', c_saud) RETURNING id INTO c_muneera_saud;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_muneera_saud);
  -- عيال منيره: علي، جمانه، عهد
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('علي', 'male', c_muneera_saud),
    ('جمانه', 'female', c_muneera_saud),
    ('عهد', 'female', c_muneera_saud);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_muneera_saud;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('منى بنت سعود', 'female', c_saud) RETURNING id INTO c_muna_saud;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_muna_saud);
  -- عيال منى: شهد
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('شهد', 'female', c_muna_saud);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_muna_saud;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('عادل بن سعود', 'male', c_saud),
    ('نبيل بن سعود', 'male', c_saud),
    ('طارق بن سعود', 'male', c_saud),
    ('علي بن سعود', 'male', c_saud),
    ('أنيسه بنت سعود', 'female', c_saud),
    ('خديجه بنت سعود', 'female', c_saud),
    ('أمل بنت سعود', 'female', c_saud);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_saud AND id NOT IN (c_muneera_saud, c_muna_saud);

  -- 2. محمد بن علي (أمه صالحه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('محمد بن علي الزدجالي (صالحه)', 'male', p_ali, w_saliha) RETURNING id INTO c_mohammed_sal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_mohammed_sal);
  -- عيال محمد: باسمه، بثينه، بشرى، خوله، احمد
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('بثينه بنت محمد', 'female', c_mohammed_sal) RETURNING id INTO c_buthaina;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_buthaina);
  -- عيال بثينه: صوغيه، عايشه، محمد
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('صوغيه', 'female', c_buthaina),
    ('عايشه', 'female', c_buthaina),
    ('محمد', 'male', c_buthaina);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_buthaina;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('باسمه بنت محمد', 'female', c_mohammed_sal),
    ('بشرى بنت محمد', 'female', c_mohammed_sal),
    ('خوله بنت محمد', 'female', c_mohammed_sal),
    ('أحمد بن محمد', 'male', c_mohammed_sal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_mohammed_sal AND id != c_buthaina;

  -- 3. هلال بن علي (أمه صالحه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('هلال بن علي الزدجالي', 'male', p_ali, w_saliha) RETURNING id INTO c_hilal_sal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_hilal_sal);
  -- عيال هلال: وليد، محمد، ايمان، احمد، عبدالعزيز، مها، شعاع، فاطمه
  -- وليد
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('وليد بن هلال', 'male', c_hilal_sal) RETURNING id INTO c_waleed;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_waleed);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('دانه بنت وليد', 'female', c_waleed),
    ('خالد بن وليد', 'male', c_waleed);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_waleed;

  -- ايمان
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('إيمان بنت هلال', 'female', c_hilal_sal) RETURNING id INTO c_eiman_hilal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_eiman_hilal);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('سلطان', 'male', c_eiman_hilal),
    ('عبدالله', 'male', c_eiman_hilal),
    ('عبدالرحمن', 'male', c_eiman_hilal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_eiman_hilal;

  -- عبدالعزيز
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('عبدالعزيز بن هلال', 'male', c_hilal_sal) RETURNING id INTO c_abdulaziz_hilal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_abdulaziz_hilal);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('مريم بنت عبدالعزيز', 'female', c_abdulaziz_hilal),
    ('هلال بن عبدالعزيز', 'male', c_abdulaziz_hilal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_abdulaziz_hilal;

  -- مها
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('مها بنت هلال', 'female', c_hilal_sal) RETURNING id INTO c_maha_hilal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_maha_hilal);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('حلا', 'female', c_maha_hilal),
    ('دانه', 'female', c_maha_hilal),
    ('جوري', 'female', c_maha_hilal),
    ('منى', 'female', c_maha_hilal),
    ('زياد', 'male', c_maha_hilal),
    ('يوسف', 'male', c_maha_hilal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_maha_hilal;

  -- شعاع
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('شعاع بنت هلال', 'female', c_hilal_sal) RETURNING id INTO c_shuaa_hilal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_shuaa_hilal);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('حميد', 'male', c_shuaa_hilal),
    ('حنين', 'female', c_shuaa_hilal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_shuaa_hilal;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('محمد بن هلال', 'male', c_hilal_sal),
    ('أحمد بن هلال', 'male', c_hilal_sal),
    ('فاطمه بنت هلال', 'female', c_hilal_sal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_hilal_sal AND id NOT IN (c_waleed, c_eiman_hilal, c_abdulaziz_hilal, c_maha_hilal, c_shuaa_hilal);

  -- 4. فاطمه بنت علي (أمها صالحه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('فاطمه بنت علي الزدجالي', 'female', p_ali, w_saliha) RETURNING id INTO c_fatima_sal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_fatima_sal);
  -- عيال فاطمه: عبدالرحمن، جمال، منصور، علي، تركيه، مريم، امينه
  -- عبدالرحمن
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('عبدالرحمن', 'male', c_fatima_sal) RETURNING id INTO c_abdulrahman_fat;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_abdulrahman_fat);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('عمر بن عبدالرحمن', 'male', c_abdulrahman_fat),
    ('عهد بنت عبدالرحمن', 'female', c_abdulrahman_fat),
    ('محمد بن عبدالرحمن', 'male', c_abdulrahman_fat),
    ('علي بن عبدالرحمن', 'male', c_abdulrahman_fat),
    ('سعود بن عبدالرحمن', 'male', c_abdulrahman_fat);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_abdulrahman_fat;

  -- مريم بنت فاطمه
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('مريم بنت فاطمه', 'female', c_fatima_sal) RETURNING id INTO c_maryam_fat;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_maryam_fat);
  -- عيال مريم وعلي زوجها: محمد، شهد، ريما، حور، جمان، روان
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('محمد', 'male', c_maryam_fat),
    ('شهد', 'female', c_maryam_fat),
    ('ريما', 'female', c_maryam_fat),
    ('حور', 'female', c_maryam_fat),
    ('جمان', 'female', c_maryam_fat),
    ('روان', 'female', c_maryam_fat);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_maryam_fat;

  -- امينه بنت فاطمه
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('أمينه بنت فاطمه', 'female', c_fatima_sal) RETURNING id INTO c_amina_fat;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_amina_fat);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('خالد', 'male', c_amina_fat),
    ('علي', 'male', c_amina_fat),
    ('عمر', 'male', c_amina_fat);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_amina_fat;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('جمال', 'male', c_fatima_sal),
    ('منصور', 'male', c_fatima_sal),
    ('علي', 'male', c_fatima_sal),
    ('تركيه', 'female', c_fatima_sal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_fatima_sal AND id NOT IN (c_abdulrahman_fat, c_maryam_fat, c_amina_fat);

  -- 5. زمزم بنت علي (أمها صالحه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('زمزم بنت علي الزدجالي', 'female', p_ali, w_saliha) RETURNING id INTO c_zamzam;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_zamzam);
  -- عيال زمزم: طلال، انور، علي، قيس، فتحيه، امل، منيره
  -- طلال
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('طلال', 'male', c_zamzam) RETURNING id INTO c_talal_zam;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_talal_zam);
  -- عيال طلال: اروى، اريج، محمد، طيف، عبدالعزيز
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('أروى بنت طلال', 'female', c_talal_zam) RETURNING id INTO c_arwa_talal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_arwa_talal);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('آيه', 'female', c_arwa_talal);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_arwa_talal;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('أريج بنت طلال', 'female', c_talal_zam) RETURNING id INTO c_areej_talal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_areej_talal);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('آمنه', 'female', c_areej_talal);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_areej_talal;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('محمد بن طلال', 'male', c_talal_zam) RETURNING id INTO c_mohammed_talal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_mohammed_talal);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('تميم بن محمد', 'male', c_mohammed_talal);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE father_id = c_mohammed_talal;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('طيف بنت طلال', 'female', c_talal_zam),
    ('عبدالعزيز بن طلال', 'male', c_talal_zam);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_talal_zam AND id NOT IN (c_arwa_talal, c_areej_talal, c_mohammed_talal);

  -- انور بن زمزم
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('أنور', 'male', c_zamzam) RETURNING id INTO c_anwar_zam;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_anwar_zam);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('خديجه بنت أنور', 'female', c_anwar_zam) RETURNING id INTO c_khadija_anwar;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_khadija_anwar);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('نواف', 'male', c_khadija_anwar),
    ('أنور', 'male', c_khadija_anwar),
    ('شيث', 'male', c_khadija_anwar);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_khadija_anwar;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('عمر بن أنور', 'male', c_anwar_zam),
    ('خالد بن أنور', 'male', c_anwar_zam);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_anwar_zam AND id != c_khadija_anwar;

  -- علي (زوج مريم)
  INSERT INTO public.persons (full_name_ar, gender, mother_id, spouse_id)
  VALUES ('علي (زوج مريم)', 'male', c_zamzam, c_maryam_fat) RETURNING id INTO c_ali_zam;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_ali_zam);
  -- Update spouse link for maryam as well
  UPDATE public.persons SET spouse_id = c_ali_zam WHERE id = c_maryam_fat;

  -- قيس بن زمزم
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('قيس', 'male', c_zamzam) RETURNING id INTO c_qais_zam;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_qais_zam);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('زينب بنت قيس', 'female', c_qais_zam) RETURNING id INTO c_zainab_qais;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_zainab_qais);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('آدم', 'male', c_zainab_qais);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_zainab_qais;

  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('ليث بن قيس', 'male', c_qais_zam),
    ('عايشه بنت قيس', 'female', c_qais_zam),
    ('هاجر بنت قيس', 'female', c_qais_zam),
    ('مريم بنت قيس', 'female', c_qais_zam);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_qais_zam AND id != c_zainab_qais;

  -- فتحيه بنت زمزم
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('فتحيه', 'female', c_zamzam) RETURNING id INTO c_fathiya_zam;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_fathiya_zam);
  -- عيال فتحيه: محمد، عبدالله، ابراهيم، فاطمه، يعقوب
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('محمد بن فتحيه', 'male', c_fathiya_zam) RETURNING id INTO c_mohammed_fath;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_mohammed_fath);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('ناديه بنت محمد', 'female', c_mohammed_fath),
    ('يوسف بن محمد', 'male', c_mohammed_fath),
    ('دانه بنت محمد', 'female', c_mohammed_fath);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE father_id = c_mohammed_fath;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('عبدالله بن فتحيه', 'male', c_fathiya_zam) RETURNING id INTO c_abdullah_fath;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_abdullah_fath);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('ريم بنت عبدالله', 'female', c_abdullah_fath);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE father_id = c_abdullah_fath;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('إبراهيم بن فتحيه', 'male', c_fathiya_zam) RETURNING id INTO c_ibrahim_fath;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_ibrahim_fath);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES ('غيد بنت إبراهيم', 'female', c_ibrahim_fath);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE father_id = c_ibrahim_fath;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('فاطمه بنت فتحيه', 'female', c_fathiya_zam) RETURNING id INTO c_fatima_fath;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_fatima_fath);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('طالب', 'male', c_fatima_fath),
    ('ليان', 'female', c_fatima_fath),
    ('عهد', 'female', c_fatima_fath),
    ('يارا', 'female', c_fatima_fath);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_fatima_fath;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('يعقوب بن فتحيه', 'male', c_fathiya_zam);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_fathiya_zam AND id NOT IN (c_mohammed_fath, c_abdullah_fath, c_ibrahim_fath, c_fatima_fath);

  -- امل بنت زمزم
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('أمل بنت زمزم', 'female', c_zamzam) RETURNING id INTO c_amal_zam;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_amal_zam);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('حسن', 'male', c_amal_zam),
    ('محمد', 'male', c_amal_zam),
    ('ساره', 'female', c_amal_zam);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_amal_zam;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('منيره بنت زمزم', 'female', c_zamzam);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_zamzam AND full_name_ar = 'منيره بنت زمزم';

  -- 6. محفوظه بنت علي (أمها صالحه)
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('محفوظه بنت علي الزدجالي', 'female', p_ali, w_saliha) RETURNING id INTO c_mahfouza_sal;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_mahfouza_sal);
  -- عيال محفوظه: بشرى، خديجه، صالحه
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('بشرى بنت محفوظه', 'female', c_mahfouza_sal) RETURNING id INTO c_bushra_mah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_bushra_mah);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('عمر بن بشرى', 'male', c_bushra_mah),
    ('صالح بن بشرى', 'male', c_bushra_mah);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_bushra_mah;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('خديجه بنت محفوظه', 'female', c_mahfouza_sal) RETURNING id INTO c_khadija_mah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_khadija_mah);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('عمار بن خديجه', 'male', c_khadija_mah),
    ('فاطمه بنت خديجه', 'female', c_khadija_mah),
    ('عبدالوهاب بن خديجه', 'male', c_khadija_mah),
    ('مريم بنت خديجه', 'female', c_khadija_mah);
  INSERT INTO public.family_tree_members (tree_id, person_id) SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_khadija_mah;

  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES ('صالحه بنت محفوظه', 'female', c_mahfouza_sal);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_mahfouza_sal AND full_name_ar = 'صالحه بنت محفوظه';


  -- ============================================================
  -- فرع الزوجة ٣: مهديم محمد سيف البلوشي
  -- عيالها: عبداللطيف، خالد، محمود، سمير، سعيد، زبيده، مريم
  -- ============================================================
  -- 1. عبداللطيف
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('عبداللطيف بن علي الزدجالي', 'male', p_ali, w_mahdim) RETURNING id INTO c_abdullatif;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_abdullatif);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('علي بن عبداللطيف', 'male', c_abdullatif),
    ('محمد بن عبداللطيف', 'male', c_abdullatif),
    ('عيسى بن عبداللطيف', 'male', c_abdullatif),
    ('علياء بنت عبداللطيف', 'female', c_abdullatif),
    ('أسماء بنت عبداللطيف', 'female', c_abdullatif),
    ('عايشه بنت عبداللطيف', 'female', c_abdullatif),
    ('مريم بنت عبداللطيف', 'female', c_abdullatif),
    ('فاطمه بنت عبداللطيف', 'female', c_abdullatif),
    ('خديجه بنت عبداللطيف', 'female', c_abdullatif),
    ('ساره بنت عبداللطيف', 'female', c_abdullatif),
    ('عبدالله بن عبداللطيف', 'male', c_abdullatif);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_abdullatif;

  -- 2. خالد
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('خالد بن علي الزدجالي', 'male', p_ali, w_mahdim) RETURNING id INTO c_khalid_mah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_khalid_mah);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('عنود بنت خالد', 'female', c_khalid_mah),
    ('تسنيم بنت خالد', 'female', c_khalid_mah),
    ('فاطمه بنت خالد', 'female', c_khalid_mah),
    ('علي بن خالد', 'male', c_khalid_mah),
    ('منتصر بن خالد', 'male', c_khalid_mah),
    ('وضاح بن خالد', 'male', c_khalid_mah);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_khalid_mah;

  -- 3. محمود
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('محمود بن علي الزدجالي', 'male', p_ali, w_mahdim) RETURNING id INTO c_mahmoud_mah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_mahmoud_mah);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('معتصم بن محمود', 'male', c_mahmoud_mah),
    ('علي بن محمود', 'male', c_mahmoud_mah),
    ('ماجد بن محمود', 'male', c_mahmoud_mah),
    ('محمد بن محمود', 'male', c_mahmoud_mah),
    ('مزنه بنت محمود', 'female', c_mahmoud_mah);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_mahmoud_mah;

  -- 4. سمير
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('سمير بن علي الزدجالي', 'male', p_ali, w_mahdim) RETURNING id INTO c_sameer;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_sameer);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('محمد بن سمير', 'male', c_sameer),
    ('فلوه بنت سمير', 'female', c_sameer);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_sameer;

  -- 5. سعيد
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('سعيد بن علي الزدجالي (مهديم)', 'male', p_ali, w_mahdim) RETURNING id INTO c_saeed_mah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_saeed_mah);
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('عمرو بن سعيد', 'male', c_saeed_mah),
    ('محمد بن سعيد', 'male', c_saeed_mah),
    ('أنس بن سعيد', 'male', c_saeed_mah),
    ('أحمد بن سعيد', 'male', c_saeed_mah);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_saeed_mah;

  -- 6. زبيده
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('زبيده بنت علي الزدجالي', 'female', p_ali, w_mahdim) RETURNING id INTO c_zubaida;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_zubaida);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('عصام', 'male', c_zubaida),
    ('رشاد', 'male', c_zubaida),
    ('علي', 'male', c_zubaida),
    ('سهام', 'female', c_zubaida),
    ('نوره', 'female', c_zubaida),
    ('شيخه', 'female', c_zubaida);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_zubaida;

  -- 7. مريم
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('مريم بنت علي الزدجالي', 'female', p_ali, w_mahdim) RETURNING id INTO c_maryam_mah;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_maryam_mah);
  INSERT INTO public.persons (full_name_ar, gender, mother_id) VALUES
    ('عمار', 'male', c_maryam_mah),
    ('محمد', 'male', c_maryam_mah),
    ('حمد', 'male', c_maryam_mah),
    ('ماجده', 'female', c_maryam_mah),
    ('منى', 'female', c_maryam_mah),
    ('شمسه', 'female', c_maryam_mah),
    ('فاطمه', 'female', c_maryam_mah),
    ('أريج', 'female', c_maryam_mah);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE mother_id = c_maryam_mah;


  -- ============================================================
  -- فرع الزوجة ٤: حسينه
  -- عيالها: سالم
  -- ============================================================
  INSERT INTO public.persons (full_name_ar, gender, father_id, mother_id)
  VALUES ('سالم بن علي الزدجالي', 'male', p_ali, w_husseina) RETURNING id INTO c_salem;
  INSERT INTO public.family_tree_members (tree_id, person_id) VALUES (v_tree_id, c_salem);

  -- عيال سالم: علي، عادل، محمد، عدنان، سلطان، عبدالله، سهيل، علياء، اسماء، مديحه، سميه
  INSERT INTO public.persons (full_name_ar, gender, father_id) VALUES
    ('علي بن سالم', 'male', c_salem),
    ('عادل بن سالم', 'male', c_salem),
    ('محمد بن سالم', 'male', c_salem),
    ('عدنان بن سالم', 'male', c_salem),
    ('سلطان بن سالم', 'male', c_salem),
    ('عبدالله بن سالم', 'male', c_salem),
    ('سهيل بن سالم', 'male', c_salem),
    ('علياء بنت سالم', 'female', c_salem),
    ('أسماء بنت سالم', 'female', c_salem),
    ('مديحه بنت سالم', 'female', c_salem),
    ('سميه بنت سالم', 'female', c_salem);
  INSERT INTO public.family_tree_members (tree_id, person_id)
  SELECT v_tree_id, id FROM public.persons WHERE father_id = c_salem;

  -- Update tree updated_at
  UPDATE public.family_trees SET updated_at = now() WHERE id = v_tree_id;

  RAISE NOTICE 'Successfully seeded Ali Essa family tree into tree %', v_tree_id;
END $$;
