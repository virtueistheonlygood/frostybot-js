-- Version 2

-- Create logs table

CREATE TABLE logs (
    uid       INTEGER      PRIMARY KEY AUTOINCREMENT
                           NOT NULL
                           UNIQUE,
    uuid      VARCHAR (36) NOT NULL
                           DEFAULT ('00000000-0000-0000-0000-000000000000'),
    timestamp TIMESTAMP    NOT NULL
                           DEFAULT (CURRENT_TIMESTAMP),
    type      VARCHAR (10) NOT NULL,
    message   TEXT         NOT NULL
);

GO;

CREATE INDEX IDX_UUID_TS ON logs (
    uuid,
    timestamp
);

-- Version 3

-- Create signals table

CREATE TABLE signals (
    uid       INTEGER      PRIMARY KEY AUTOINCREMENT
                           UNIQUE
                           NOT NULL,
    timestamp DATETIME     NOT NULL
                           DEFAULT (CURRENT_TIMESTAMP),
    provider  VARCHAR (36) NOT NULL,
    user      VARCHAR (36) NOT NULL,
    exchange  VARCHAR (50) NOT NULL,
    stub      VARCHAR (50) NOT NULL,
    symbol    VARCHAR (50) NOT NULL,
    signal    VARCHAR (50) NOT NULL,
    result    BOOLEAN      NOT NULL,
    message   TEXT         NOT NULL
);

GO;

CREATE INDEX IDX_TIMESTAMP ON signals (
    timestamp
);

CREATE INDEX IDX_PROVIDER ON signals (
    provider
);

CREATE INDEX IDX_USER ON signals (
    user
);

CREATE INDEX IDX_RESULT ON signals (
    result
);

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

CREATE UNIQUE INDEX IDX_ORDERS_UUID_STUB_ORDERID ON orders (
    uuid,
    stub,
    orderid
);

CREATE INDEX IDX_ORDERS_UUID_STUB_CUSTOMID ON orders (
    uuid,
    stub,
    customid
);

CREATE INDEX IDX_ORDERS_UUID_STUB_TS ON orders (
    uuid,
    stub,
    timestamp
);

CREATE INDEX IF NOT EXISTS IDX_ORDERS_UUID_STUB_SYMBOL ON orders (
    uuid,
    stub,
    symbol
);

-- Create datasources table

CREATE TABLE datasources (
    uid         INTEGER      PRIMARY KEY AUTOINCREMENT
                             UNIQUE
                             NOT NULL,
    datasource  VARCHAR (50) NOT NULL,
    objectclass VARCHAR (50) NOT NULL,
    timestamp   BIGINT       NOT NULL,
    expiry      BIGINT       NULL,
    ttl         INTEGER      NULL,
    unqkey      VARCHAR (100) NOT NULL,
    idxkey1     VARCHAR (100) NULL,
    idxkey2     VARCHAR (100) NULL,
    idxkey3     VARCHAR (100) NULL,
    data        TEXT         NOT NULL
);

CREATE UNIQUE INDEX UNQ_DATASOURCE_UNQKEY ON datasources (
    datasource,
    unqkey
);

CREATE INDEX IDX_DATASOURCE_IDXKEYS ON datasources (
    datasource,
    idxkey1,
    idxkey2,
    idxkey3
);

CREATE INDEX IDX_OBJECTCLASS_IDXKEYS ON datasources (
    objectclass,
    idxkey1,
    idxkey2,
    idxkey3
);

-- Update version

INSERT OR REPLACE INTO `settings` (mainkey, subkey, value) VALUES ('core', 'sqlite:dbver', 5);