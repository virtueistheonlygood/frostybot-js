--
-- Table structure for table `orders`
--


CREATE TABLE `orders` (
  `uid` BIGINT NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(36) NOT NULL,
  `stub` VARCHAR(20) NOT NULL,
  `orderid` VARCHAR(15) NOT NULL,
  `customid` VARCHAR(15) NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `timestamp` TIMESTAMP NOT NULL,
  `type` VARCHAR(15) NOT NULL,
  `direction` VARCHAR(4) NOT NULL,
  `order_price` DECIMAL(18, 8) NOT NULL,
  `trigger_price` DECIMAL(18, 8) NULL,
  `size_base` DECIMAL(18, 8) NOT NULL,
  `size_quote` DECIMAL(18, 8) NOT NULL,
  `size_usd` DECIMAL(18, 8) NOT NULL,
  `filled_base` DECIMAL(18, 8) NOT NULL,
  `filled_quote` DECIMAL(18, 8) NOT NULL,
  `filled_usd` DECIMAL(18, 8) NOT NULL,
  `status` VARCHAR(15) NOT NULL,
  `metadata` TEXT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE INDEX `uid_UNIQUE` (`uid` ASC) VISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_ORDERID` (`uuid` ASC, `stub` ASC, `orderid` ASC) INVISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_CUSTOMID` (`uuid` ASC, `stub` ASC, `customid` ASC) VISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_TS` (`uuid` ASC, `stub` ASC, `timestamp` ASC) INVISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_SYMBOL` (`uuid` ASC, `stub` ASC, `symbol` ASC) VISIBLE);

--
-- Table structure for table `datasources`
--

CREATE TABLE `datasources` (
  `uid` BIGINT NOT NULL AUTO_INCREMENT,
  `datasource` VARCHAR(50) NOT NULL,
  `objectclass` VARCHAR(50) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `expiry` BIGINT NULL,
  `ttl` INT NULL,
  `unqkey` VARCHAR(100) NOT NULL,
  `idxkey1` VARCHAR(100) NULL,
  `idxkey2` VARCHAR(100) NULL,
  `idxkey3` VARCHAR(100) NULL,
  `data` TEXT NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE INDEX `uid_UNIQUE` (`uid` ASC) VISIBLE,
  UNIQUE INDEX `UNQ_DATASOURCE_UNQKEY` (`datasource` ASC, `unqkey` ASC) INVISIBLE,
  INDEX `DX_DATASOURCE_IDXKEYS` (`datasource` ASC, `idxkey1` ASC, `idxkey2` ASC, `idxkey3` ASC) INVISIBLE,
  INDEX `DX_OBJECTCLASS_IDXKEYS` (`idxkey1` ASC, `idxkey2` ASC, `objectclass` ASC) VISIBLE);


--
-- Update version
--

REPLACE INTO `settings` (`mainkey`, `subkey`, `value`) VALUES ('core', 'mysql:dbver', '3');