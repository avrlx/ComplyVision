-- Existing records remain available for audit; validate old rows separately before VALIDATE CONSTRAINT.
alter table public.inspections add constraint inspections_source_preview_bounded
  check (source_image_data_url is null or
    (octet_length(source_image_data_url) <= 2097152 and source_image_data_url ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')) not valid;
