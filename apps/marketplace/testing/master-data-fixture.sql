-- Ausschließlich für die isolierte Testdatenbank; produktive Pflege erfolgt auf der Website.
\set ON_ERROR_STOP on
\getenv is_test MARKETPLACE_TEST_DATABASE
\if :is_test
\else
  \quit 1
\endif
INSERT INTO marketplace."AttributeOption" ("id", "attributeId", "label") VALUES
  ('test-material-wood', 'chairs-material', 'Holz'),
  ('test-material-metal', 'chairs-material', 'Metall'),
  ('test-color-black', 'chairs-color', 'Schwarz'),
  ('test-color-natural', 'chairs-color', 'Natur'),
  ('test-kind-dining', 'chairs-kind', 'Esszimmerstuhl'),
  ('test-kind-bar', 'chairs-kind', 'Barhocker'),
  ('test-model-north', 'chairs-model', 'Nord'),
  ('test-model-curve', 'chairs-model', 'Bogen')
ON CONFLICT ("attributeId", "label") DO NOTHING;
