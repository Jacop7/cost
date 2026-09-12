-- Separate causes must not be presented as manual edits or fixed costs.
alter type public.change_source add value if not exists 'material';
alter type public.change_source add value if not exists 'tax';
