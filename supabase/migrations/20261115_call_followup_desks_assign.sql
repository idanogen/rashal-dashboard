-- שיוך שולחנות הרכש (15/11/2026, עמי בהקלטה): חנוטין = בית מלאכה, גריגורייב = מחסן.
update call_followup_desks set profile_id = case desk
  when 'workshop' then 'c769fdb5-43e8-44ec-be50-43a7b43dd46f'::uuid
  when 'warehouse' then '2f4e1a15-26c7-4e5f-9dbf-2e7a3ee6b573'::uuid
end
where desk in ('workshop', 'warehouse');
