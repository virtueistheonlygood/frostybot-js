-- Version 4

-- Create orders table

CREATE TABLE orders (
    uid             INTEGER        PRIMARY KEY AUTOINCREMENT
                                   NOT NULL
                                   UNIQUE,
    uuid            VARCHAR (36)   NOT NULL,
    stub            VARCHAR (20)   NOT NULL,
    orderid         VARCHAR (15)   NOT NULL,
    customid        VARCHAR (15),
    symbol          VARCHAR (20)   NOT NULL,
    timestamp       TIMESTAMP      NOT NULL,
    type            VARCHAR (15)   NOT NULL,
    direction       VARCHAR (4)    NOT NULL,
    order_price     DECIMAL (18, 8) NOT NULL,
    trigger_price   DECIMAL (18, 8),
    size_base       DECIMAL (18, 8) NOT NULL,
    size_quote      DECIMAL (18, 8) NOT NULL,
    size_usd        DECIMAL (18, 8) NOT NULL,
    filled_base     DECIMAL (18, 8) NOT NULL,
    filled_quote    DECIMAL (18, 8) NOT NULL,
    filled_usd      DECIMAL (18, 8) NOT NULL,
    status          VARCHAR (15)   NOT NULL,
    metadata        TEXT
);

GO;

CREATE UNIQUE INDEX IF NOT EXISTS IDX_ORDERS_UUID_STUB_ORDERID ON orders (
    uuid,
    stub,
    orderid
);

CREATE INDEX IF NOT EXISTS IDX_ORDERS_UUID_STUB_CUSTOMID ON orders (
    uuid,
    stub,
    customid,
);

CREATE INDEX IF NOT EXISTS IDX_ORDERS_UUID_STUB_TS ON orders (
    uuid,
    stub,
    timestamp
);

CREATE INDEX IF NOT EXISTS IDX_ORDERS_UUID_STUB_SYMBOL ON orders (
    uuid,
    stub,
    symbol
);

GO;

-- Ensure that indexes are all created

CREATE INDEX IF NOT EXISTS IDX_UUID_TS ON logs (
    uuid,
    timestamp
);

CREATE INDEX IF NOT EXISTS IDX_TIMESTAMP ON signals (
    timestamp
);

CREATE INDEX IF NOT EXISTS IDX_PROVIDER ON signals (
    provider
);

CREATE INDEX IF NOT EXISTS IDX_USER ON signals (
    user
);

CREATE INDEX IF NOT EXISTS IDX_RESULT ON signals (
    result
);


GO;


-- Update version

INSERT OR REPLACE INTO `settings` (mainkey, subkey, value) VALUES ('core', 'sqlite:dbver', 5);