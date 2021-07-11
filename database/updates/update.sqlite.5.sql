-- Version 5

-- Add metadata column to signals table

ALTER TABLE signals ADD COLUMN metadata TEST NULL;

GO

-- Create tokens table

CREATE TABLE tokens (
    uid    INTEGER      PRIMARY KEY AUTOINCREMENT
                        UNIQUE
                        NOT NULL,
    uuid   VARCHAR (36) NOT NULL,
    token  VARCHAR (36) NOT NULL,
    expiry DATETIME     NOT NULL
);

GO

CREATE UNIQUE INDEX IDX_UUID_TOKEN ON tokens (
    uuid,
    token
);

GO


-- Update version

INSERT OR REPLACE INTO `settings` (mainkey, subkey, value) VALUES ('core', 'sqlite:dbver', 6);