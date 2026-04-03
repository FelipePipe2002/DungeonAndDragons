CREATE TABLE organization_landmarks (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  landmark_id BIGINT NOT NULL,
  CONSTRAINT fk_org_landmarks_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_org_landmarks_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks (id) ON DELETE CASCADE,
  CONSTRAINT uk_org_landmark UNIQUE (organization_id, landmark_id)
);
