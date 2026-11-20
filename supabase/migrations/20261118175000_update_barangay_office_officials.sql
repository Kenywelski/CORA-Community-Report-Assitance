create or replace function private.normalize_barangay_office_title(_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(lower(btrim(_title)), '^office of (the )?', ''),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

do $$
declare
  configured_office record;
  existing_office record;
  office_metadata jsonb;
  stored_responsibilities text;
  content_is_object boolean;
begin
  for configured_office in
    select office_name, officials
    from (values
      (
        'Office of the Punong Barangay',
        '[{"name":"Emmanuel P. Isiang","position":"Punong Barangay"}]'::jsonb
      ),
      (
        'Office of the Sangguniang Barangay',
        '[
          {"name":"Jose M. Ihapon, Jr.","position":"Barangay Kagawad"},
          {"name":"Charlita G. Montenegro","position":"Barangay Kagawad"},
          {"name":"Jerusalem T. Montero","position":"Barangay Kagawad"},
          {"name":"Jane C. Buniel","position":"Barangay Kagawad"},
          {"name":"Eva M. Gemao","position":"Barangay Kagawad"},
          {"name":"John Earl J. Elizalde","position":"Barangay Kagawad"},
          {"name":"Vicente A. Portillo, Jr.","position":"Barangay Kagawad"}
        ]'::jsonb
      ),
      (
        'Office of the Sangguniang Kabataan',
        '[{"name":"Vince Dylan E. Curada","position":"Sangguniang Kabataan"}]'::jsonb
      ),
      (
        'Office of the Barangay Secretary',
        '[{"name":"Shannon James Q. Porras","position":"Barangay Secretary"}]'::jsonb
      ),
      (
        'Office of the Barangay Treasurer',
        '[{"name":"Heries B. Dela Cruz","position":"Barangay Treasurer"}]'::jsonb
      )
    ) as offices(office_name, officials)
  loop
    for existing_office in
      select id, content
      from public.knowledge_base
      where category = 'Barangay Office'
        and private.normalize_barangay_office_title(title) =
          private.normalize_barangay_office_title(configured_office.office_name)
    loop
      content_is_object := true;
      begin
        office_metadata := existing_office.content::jsonb;
        if jsonb_typeof(office_metadata) <> 'object' then
          content_is_object := false;
        end if;
      exception when invalid_text_representation then
        content_is_object := false;
      end;

      if content_is_object then
        stored_responsibilities := coalesce(
          nullif(office_metadata->>'responsibilities', ''),
          office_metadata->>'services_offered',
          ''
        );
      else
        stored_responsibilities := existing_office.content;
        office_metadata := jsonb_build_object(
          'legacy_content',
          existing_office.content
        );
      end if;

      office_metadata := office_metadata || jsonb_build_object(
        'officials',
        configured_office.officials,
        'responsibilities',
        stored_responsibilities
      );

      update public.knowledge_base
      set content = office_metadata::text,
          updated_at = now()
      where id = existing_office.id;
    end loop;

    if not exists (
      select 1
      from public.knowledge_base
      where category = 'Barangay Office'
        and private.normalize_barangay_office_title(title) =
          private.normalize_barangay_office_title(configured_office.office_name)
    ) then
      insert into public.knowledge_base (
        title,
        category,
        content,
        tags,
        is_active
      )
      values (
        configured_office.office_name,
        'Barangay Office',
        jsonb_build_object(
          'officials',
          configured_office.officials,
          'responsibilities',
          ''
        )::text,
        array['office', 'directory', 'purisima'],
        true
      );
    end if;
  end loop;
end;
$$;

drop function private.normalize_barangay_office_title(text);
