/* 
  Asset Tracker Database Schema
  Run this script in your MSSQL Server management tool.
*/

-- Create Database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'AssetTrackerDB')
BEGIN
    CREATE DATABASE AssetTrackerDB;
END
GO

USE AssetTrackerDB;
GO

-- Create Assets Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Assets')
BEGIN
    CREATE TABLE Assets (
        AssetID INT IDENTITY(1,1) PRIMARY KEY,
        AssetNumber AS ('AST-' + RIGHT('000000' + CAST(AssetID AS VARCHAR(6)), 6)) PERSISTED,
        AssetName NVARCHAR(255) NOT NULL,
        AssetType NVARCHAR(50) NOT NULL,
        Brand NVARCHAR(100),
        Model NVARCHAR(100),
        Description NVARCHAR(MAX),
        Status NVARCHAR(50) DEFAULT 'working',
        ServiceDetails NVARCHAR(MAX),
        AccessType NVARCHAR(50) DEFAULT 'on premise',
        CreatedDate DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create AssetImages Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetImages')
BEGIN
    CREATE TABLE AssetImages (
        ImageID INT IDENTITY(1,1) PRIMARY KEY,
        AssetID INT FOREIGN KEY REFERENCES Assets(AssetID) ON DELETE CASCADE,
        ImagePath NVARCHAR(MAX) NOT NULL,
        UploadedDate DATETIME DEFAULT GETDATE()
    );
END
GO
