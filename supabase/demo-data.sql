-- =====================================================================
-- Données de démonstration (fictives) — secteur de Nantes
-- ---------------------------------------------------------------------
-- Mode d'emploi (voir README, section 5) :
--   1. Créez un compte dans l'application (idéalement un compte dédié à la démo).
--   2. Remplacez l'email ci-dessous (ligne « v_email ») par celui de ce compte.
--   3. Copiez tout ce fichier dans Supabase > SQL Editor > New query, puis « Run ».
-- Le script refuse de s'exécuter si le compte contient déjà des contacts,
-- pour ne jamais mélanger démo et vraies données.
-- Les personnes sont fictives ; les numéros de téléphone appartiennent à la plage
-- 06 39 98 xx xx réservée par l'ARCEP aux œuvres de fiction.
-- =====================================================================

do $$
declare
  v_email text := 'demo@exemple.fr'; -- ⚠️ REMPLACEZ PAR L'EMAIL DE VOTRE COMPTE DE DÉMONSTRATION
  v_user uuid;
  -- Aujourd'hui à minuit, heure de Paris (pour placer les rendez-vous du jour).
  v_today timestamp := date_trunc('day', now() at time zone 'Europe/Paris');

  -- Contacts
  c_helene uuid := gen_random_uuid();
  c_patrick uuid := gen_random_uuid();
  c_sophie uuid := gen_random_uuid();
  c_jeanluc uuid := gen_random_uuid();
  c_isabelle uuid := gen_random_uuid();
  c_thomas uuid := gen_random_uuid();
  c_camille uuid := gen_random_uuid();
  c_julien uuid := gen_random_uuid();
  c_nadia uuid := gen_random_uuid();
  c_lucas uuid := gen_random_uuid();
  c_anne uuid := gen_random_uuid();
  c_karim uuid := gen_random_uuid();

  -- Biens
  v_date date := (now() at time zone 'Europe/Paris')::date;
  p_crebillon uuid := gen_random_uuid();
  p_strasbourg uuid := gen_random_uuid();
  p_poilus uuid := gen_random_uuid();
  p_reze uuid := gen_random_uuid();
  p_bellamy uuid := gen_random_uuid();
  p_kervegan uuid := gen_random_uuid();
  p_duguay uuid := gen_random_uuid();
  p_guisthau uuid := gen_random_uuid();
  p_villeenbois uuid := gen_random_uuid();
  p_herblain uuid := gen_random_uuid();
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'Aucun compte trouvé avec l''email %. Créez d''abord le compte dans l''application, puis corrigez la ligne v_email.', v_email;
  end if;
  if exists (select 1 from public.contacts where user_id = v_user) then
    raise exception 'Le compte % contient déjà des contacts : utilisez un compte dédié à la démonstration.', v_email;
  end if;

  -- -------------------------------------------------------------------
  -- Contacts
  -- -------------------------------------------------------------------
  insert into public.contacts
    (id, user_id, first_name, last_name, phone, email, address, postal_code, city, source, roles, partner_type, seller_stage, buyer_stage, notes)
  values
    (c_helene, v_user, 'Hélène', 'Moreau', '06 39 98 10 01', 'helene.moreau@exemple.fr', '12 rue Crébillon', '44000', 'Nantes', 'recommandation',
      '{vendeur}', null, 'mandat', null, 'Recommandée par Maître Dubois. Vend l''appartement familial, pas pressée.'),
    (c_patrick, v_user, 'Patrick', 'Lefebvre', '06 39 98 10 02', 'p.lefebvre@exemple.fr', '8 rue de Strasbourg', '44000', 'Nantes', 'pige',
      '{vendeur}', null, 'estimation', null, 'Annonce particulier repérée en pige. Souhaite une estimation avant de signer.'),
    (c_sophie, v_user, 'Sophie', 'Garnier', '06 39 98 10 03', 'sophie.garnier@exemple.fr', '25 boulevard des Poilus', '44300', 'Nantes', 'boitage',
      '{vendeur}', null, 'prospect', null, 'Réponse au boîtage. Mutation possible au printemps.'),
    (c_jeanluc, v_user, 'Jean-Luc', 'Bernard', '06 39 98 10 04', 'jl.bernard@exemple.fr', '4 rue du Château', '44400', 'Rezé', 'autre',
      '{vendeur}', null, 'mandat', null, 'Maison de famille, succession réglée.'),
    (c_isabelle, v_user, 'Isabelle', 'Fontaine', '06 39 98 10 05', 'isabelle.fontaine@exemple.fr', '17 rue Paul Bellamy', '44000', 'Nantes', 'recommandation',
      '{vendeur,acquereur}', null, 'mandat', 'qualifie', 'Vend sa maison pour acheter un appartement en centre-ville.'),
    (c_thomas, v_user, 'Thomas', 'Petit', '06 39 98 10 06', 'thomas.petit@exemple.fr', null, '44000', 'Nantes', 'portail',
      '{acquereur}', null, null, 'qualifie', 'Primo-accédant, travaille au CHU.'),
    (c_camille, v_user, 'Camille', 'Robin', '06 39 98 10 07', 'camille.robin@exemple.fr', null, '44100', 'Nantes', 'recommandation',
      '{acquereur}', null, null, 'en_visite', 'Couple avec deux enfants, cherche une maison avec jardin.'),
    (c_julien, v_user, 'Julien', 'Faure', '06 39 98 10 08', 'julien.faure@exemple.fr', null, null, 'Nantes', 'portail',
      '{acquereur}', null, null, 'nouveau', 'Investissement locatif, premier contact par le portail.'),
    (c_nadia, v_user, 'Nadia', 'Benali', '06 39 98 10 09', 'nadia.benali@exemple.fr', null, '44800', 'Saint-Herblain', 'portail',
      '{acquereur}', null, null, 'offre', 'Offre en cours sur un autre bien (concurrence).'),
    (c_lucas, v_user, 'Lucas', 'Girard', '06 39 98 10 10', null, '3 rue Kervégan', '44000', 'Nantes', 'pige',
      '{prospect}', null, null, null, 'Propriétaire sur l''île Feydeau, à recontacter.'),
    (c_anne, v_user, 'Anne', 'Dubois', '06 39 98 10 11', 'office.dubois@exemple.fr', '2 place du Commerce', '44000', 'Nantes', 'autre',
      '{partenaire}', 'notaire', null, null, 'Notaire, très réactive pour les compromis.'),
    (c_karim, v_user, 'Karim', 'Haddad', '06 39 98 10 12', 'karim.haddad@exemple.fr', null, '44000', 'Nantes', 'autre',
      '{partenaire}', 'courtier', null, null, 'Courtier en crédit immobilier.');

  -- Contacts saisis il y a 3 mois (pour que la relance « 30 jours sans contact » soit visible).
  update public.contacts set created_at = now() - interval '90 days' where user_id = v_user;

  -- -------------------------------------------------------------------
  -- Qualification et critères des acquéreurs
  -- -------------------------------------------------------------------
  insert into public.buyer_profiles
    (contact_id, user_id, budget_max, financing_approved, down_payment, timeframe, needs_prior_sale, motivation,
     property_types, locations, min_surface, min_rooms, must_haves)
  values
    (c_thomas, v_user, 320000, true, 40000, '3_mois', false, 4, '{appartement}', '{Nantes}', 60, 3, '{ascenseur}'),
    (c_camille, v_user, 450000, true, 90000, 'immediat', false, 5, '{maison}', '{Nantes,Rezé}', 100, 4, '{jardin,parking}'),
    (c_julien, v_user, 200000, false, 15000, '6_mois', false, 3, '{appartement}', '{Nantes}', 35, 2, '{}'),
    (c_nadia, v_user, 280000, true, 30000, 'immediat', false, 5, '{appartement,maison}', '{Nantes,Saint-Herblain}', 55, 3, '{exterieur}'),
    (c_isabelle, v_user, 300000, null, 0, '6_mois', true, 3, '{appartement}', '{44000}', 70, 3, '{ascenseur,parking}');

  -- -------------------------------------------------------------------
  -- Échanges (timeline) et rendez-vous
  -- -------------------------------------------------------------------
  insert into public.interactions (user_id, contact_id, kind, occurred_at, content)
  values
    (v_user, c_helene, 'appel', now() - interval '20 days', 'Premier appel, recommandée par Maître Dubois.'),
    (v_user, c_helene, 'rdv', now() - interval '15 days', 'Visite de l''appartement et estimation.'),
    (v_user, c_helene, 'email', now() - interval '10 days', 'Envoi du mandat exclusif pour signature électronique.'),
    (v_user, c_patrick, 'appel', now() - interval '3 days', 'Accepte un rendez-vous d''estimation.'),
    (v_user, c_patrick, 'rdv', (v_today + time '10:00') at time zone 'Europe/Paris', 'Rendez-vous d''estimation au 8 rue de Strasbourg.'),
    (v_user, c_sophie, 'note', now() - interval '8 days', 'Coupon boîtage reçu. Rappeler en soirée.'),
    (v_user, c_jeanluc, 'rdv', now() - interval '45 days', 'Signature du mandat simple.'),
    (v_user, c_isabelle, 'appel', now() - interval '6 days', 'Point sur la vente et sa recherche d''appartement.'),
    (v_user, c_thomas, 'appel', now() - interval '40 days', 'Qualification : accord de principe obtenu, cherche un T3 avec ascenseur.'),
    (v_user, c_camille, 'sms', now() - interval '2 days', 'Confirmation de la visite de la maison de Rezé.'),
    (v_user, c_camille, 'rdv', (v_today + time '17:30') at time zone 'Europe/Paris', 'Point financement à l''agence avec Karim Haddad.'),
    (v_user, c_julien, 'email', now() - interval '1 day', 'Demande d''informations reçue via le portail.'),
    (v_user, c_nadia, 'appel', now() - interval '12 days', 'Offre en cours ailleurs, garder le contact.'),
    (v_user, c_lucas, 'appel', now() - interval '60 days', 'Pas vendeur pour l''instant, rappeler dans 2 mois.'),
    (v_user, c_karim, 'rdv', (v_today + interval '2 days' + time '09:30') at time zone 'Europe/Paris', 'Petit-déjeuner partenaires.');

  -- -------------------------------------------------------------------
  -- Biens (adresses réelles de Nantes et environs, biens fictifs)
  -- -------------------------------------------------------------------
  insert into public.properties
    (id, user_id, seller_contact_id, type, address, postal_code, city, citycode, latitude, longitude,
     surface, rooms, bedrooms, floor, has_elevator, outdoor, parking, construction_year, dpe, ges, condition,
     price, charges_annual, property_tax, description, status, mandate_type, mandate_start, mandate_end, mandate_fees)
  values
    (p_crebillon, v_user, c_helene, 'appartement', '12 Rue Crébillon', '44000', 'Nantes', '44109', 47.2133, -1.5604,
     78, 4, 2, 3, true, 'balcon', 'aucun', 1890, 'D', 'D', 'bon',
     395000, 1800, 1450, 'Bel appartement haussmannien en plein centre, parquet, moulures et cheminées. Balcon filant.',
     'en_vente', 'exclusif', v_date - 70, v_date + 20, 15000),
    (p_strasbourg, v_user, c_patrick, 'appartement', '8 Rue de Strasbourg', '44000', 'Nantes', '44109', 47.2165, -1.5509,
     65, 3, 2, 2, false, 'aucun', 'aucun', 1930, 'E', 'E', 'a_rafraichir',
     255000, 1200, 1100, 'Appartement traversant à rafraîchir, proche cathédrale.',
     'estimation', null, null, null, null),
    (p_poilus, v_user, c_sophie, 'maison', '25 Boulevard des Poilus', '44300', 'Nantes', '44109', 47.2310, -1.5320,
     110, 5, 4, 0, null, 'jardin', 'garage', 1965, 'D', 'C', 'bon',
     489000, null, 1900, 'Maison familiale sur sous-sol avec jardin de 400 m².',
     'estimation', null, null, null, null),
    (p_reze, v_user, c_jeanluc, 'maison', '4 Rue du Château', '44400', 'Rezé', '44143', 47.1906, -1.5560,
     120, 5, 4, 0, null, 'jardin', 'garage', 1978, 'D', 'D', 'bon',
     435000, null, 2100, 'Maison lumineuse, séjour de 40 m², quatre chambres, jardin arboré et garage double.',
     'en_vente', 'simple', v_date - 45, v_date + 75, 18000),
    (p_bellamy, v_user, c_isabelle, 'maison', '17 Rue Paul Bellamy', '44000', 'Nantes', '44109', 47.2225, -1.5577,
     95, 4, 3, 0, null, 'jardin', 'aucun', 1925, 'E', 'E', 'a_rafraichir',
     520000, null, 2300, 'Maison de ville avec jardin de ville, beaux volumes, travaux de rafraîchissement à prévoir.',
     'sous_offre', 'exclusif', v_date - 85, v_date + 5, 20000),
    (p_kervegan, v_user, c_lucas, 'appartement', '3 Rue Kervégan', '44000', 'Nantes', '44109', 47.2120, -1.5575,
     92, 4, 2, 2, false, 'aucun', 'aucun', 1750, 'F', 'F', 'travaux',
     380000, 2200, 1600, 'Appartement de caractère sur l''île Feydeau, gros travaux à prévoir.',
     'estimation', null, null, null, null),
    (p_duguay, v_user, c_jeanluc, 'appartement', '10 Allée Duguay-Trouin', '44000', 'Nantes', '44109', 47.2128, -1.5555,
     45, 2, 1, 4, true, 'balcon', 'place', 1972, 'D', 'E', 'bon',
     189000, 1400, 850, 'T2 avec balcon et place de parking, idéal investissement locatif.',
     'en_vente', 'simple', v_date - 10, v_date + 80, 9000),
    (p_guisthau, v_user, c_sophie, 'appartement', '56 Boulevard Guist''hau', '44000', 'Nantes', '44109', 47.2172, -1.5652,
     70, 3, 2, 5, true, 'terrasse', 'place', 1968, 'C', 'C', 'tres_bon',
     315000, 1900, 1250, 'Dernier étage avec terrasse de 15 m², rénové en 2022, ascenseur et parking.',
     'en_vente', 'exclusif', v_date - 30, v_date + 150, 14000),
    (p_villeenbois, v_user, c_helene, 'appartement', '15 Rue de la Ville-en-Bois', '44100', 'Nantes', '44109', 47.2069, -1.5844,
     58, 3, 2, 1, false, 'balcon', 'aucun', 1985, 'D', 'D', 'bon',
     229000, 1100, 950, 'T3 calme avec balcon, proche tramway.',
     'en_vente', 'simple', v_date - 20, v_date + 70, 10000),
    (p_herblain, v_user, c_jeanluc, 'maison', '7 Rue de la Paix', '44800', 'Saint-Herblain', '44162', 47.2165, -1.6420,
     85, 4, 3, 0, null, 'jardin', 'place', 1995, 'C', 'B', 'bon',
     299000, null, 1500, 'Maison de plain-pied vendue en 3 semaines.',
     'vendu', 'exclusif', v_date - 120, v_date - 30, 13000);

  -- -------------------------------------------------------------------
  -- Visites et retours
  -- -------------------------------------------------------------------
  insert into public.visits (user_id, property_id, buyer_contact_id, visited_at, rating, feedback, feedback_sent_at)
  values
    -- Retour saisi mais pas encore transmis au vendeur
    (v_user, p_reze, c_camille, now() - interval '2 days', 4, 'Coup de cœur pour le jardin, trouve la cuisine à refaire.', null),
    -- Visite passée sans retour
    (v_user, p_villeenbois, c_nadia, now() - interval '5 days', null, null, null),
    -- Retour transmis
    (v_user, p_guisthau, c_isabelle, now() - interval '10 days', 3, 'Aime la terrasse, hésite sur le prix.', now() - interval '9 days'),
    -- Visite prévue aujourd'hui à 14 h
    (v_user, p_duguay, c_julien, (v_today + time '14:00') at time zone 'Europe/Paris', null, null, null);

  raise notice 'Données de démonstration créées pour %.', v_email;
end;
$$;
