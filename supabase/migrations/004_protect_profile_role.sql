-- Profile ownership must not allow users to promote themselves.
revoke update on table public.profiles from authenticated;
grant update (full_name, age, designation, employee_id, department,
  qualification, experience_years, office_location, address, bio)
  on public.profiles to authenticated;
