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
    order_price     DECIMAL (8, 8) NOT NULL,
    trigger_price   DECIMAL (8, 8),
    size_base       DECIMAL (8, 8) NOT NULL,
    size_quote      DECIMAL (8, 8) NOT NULL,
    size_usd        DECIMAL (8, 8) NOT NULL,
    filled_base     DECIMAL (8, 8) NOT NULL,
    filled_quote    DECIMAL (8, 8) NOT NULL,
    filled_usd      DECIMAL (8, 8) NOT NULL,
    status          VARCHAR (15)   NOT NULL,
    metadata        TEXT
);

CREATE INDEX IDX_ORDERS_UUID_STUB_ORDERID ON orders (
    uuid,
    stub,
    id
);

CREATE INDEX IDX_ORDERS_UUID_STUB_CUSTOMID ON orders (
    uuid,
    stub,
    customid,
);

CREATE INDEX IDX_ORDERS_UUID_STUB_TS ON orders (
    uuid,
    stub,
    timestamp
);

CREATE INDEX IDX_ORDERS_UUID_STUB_SYMBOL ON orders (
    uuid,
    stub,
    symbol
);

-- Update version

INSERT OR REPLACE INTO `settings` (mainkey, subkey, value) VALUES ('core', 'sqlite:dbver', 5);