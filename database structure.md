
database name: defaultdb
Host: mysql-5fb8d56-fernandezjasper463-4e1d.c.aivencloud.com
Port: 13484
User: avnadmin
Password: <REDACTED_PASSWORD>
CA certificate: -----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIUKmr59IoE311y+ylOu1I7DXZOuUwwDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvYmE0ZGVhMmYtYzNkYS00NWNhLThmNTQtNjllNTAyYzRh
OGRhIFByb2plY3QgQ0EwHhcNMjYwMzEwMDI1ODQ4WhcNMzYwMzA3MDI1ODQ4WjA6
MTgwNgYDVQQDDC9iYTRkZWEyZi1jM2RhLTQ1Y2EtOGY1NC02OWU1MDJjNGE4ZGEg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAOG0HhbK
5XD/riLuqvOSOVnRearN/NLKtHC2hrnqO2cBb1RTzR6kXVnJQJQTasqKJKy5o+vF
w9Ep1J4KfrdAr5x0ZdW9HtWbJrtI0eJML1qZIp9FIq7XlMm7hWcwXxEAy5+HbVpr
64wfA1Mpha/Ixj7SVbuhnPzzDPwfjo1EoUi15vPWtnRvNMSXtwE+ek/6nLZIsO6s
nXbPTNB2JHdDNwbI+aybid462BshWCmFOdUuFOSSgts7keZH/5t2Vco97M+//usZ
jCLAb2fNcP+S8aXqaYQPrJCgf5VxsaJz6jYnYC8H1RFTOKI9JdzW4OimDpYPLygV
LeRjxa7RdUb6TQqqvS2kEXg3RU7kVb3dYGIlQKpYMmAy5a0nLDJxQC8/nkno4KQg
2i/cLYumjqo0TrzPMhoAlBJXCKf2BUcPnoc8JwEPzucAm+I7juM11Z5E4NS98kjg
QCQLyqFE46UCDPzVCWBukJRkW1tMycmx+o//uGFBBtUQAsuu2SSDL79pAwIDAQAB
o0IwQDAdBgNVHQ4EFgQUhvCTEHHZ3TetkLWe2ubsN9vHoIgwEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAHCULvdBSDPo
gwgk7+B4oqDDe6cnz+9xbjWfzW/nIB6LucQJG17tKuzAW91SNHSWAt2TTfJtDyA6
ji2qBY8P4uffKp/nkcFg3/cHmTPWrMJGoGEvjbjdtrhh3HRtKU7iTaPJfFRDA1gV
pHwC+MZnw4fZ7pzsPdthTaPr3T9Nxs0I4Oy8Y1l4/erUGyAGDBg3x4RtOu2wmh59
PTLQeS3rzT34aqYHrWoPOZFp/kQhzSoJw7BjoipyHR3MdgrPfnWxWhT9QEOjBQV5
2AOC8s8N13jFlQJlU6hE2DwEUUbnfFwV6iL3WkUB2XWOExXz4TLY6Pj7c8G7qGqy
UZ62ErR6H7n9qsIoHNIFJYene/WoptYeGtERbc+XqujydaT5TS2ZKhrH8UpM3Giv
1DkesltdQcw4jjRCy9yg/JJJQia7lVj1nMwCXNZCsC5FtZ2s+0t4cAlU2c2n+dnL
PT1aFIz/ua9LAXFu//DdWLFj8Tt7gkyCu0Ob56EtuxnuwlLZ6KYv1w==
-----END CERTIFICATE-----

database structure:

CAMPUS: 

&#x09;name - varchar

&#x09;location - varchar

&#x09;about - varchar

campus photos:

&#x09;campus\_id - int

&#x09;image\_url - varchar



department:

&#x09;name - varchar

&#x09;description -varchar

&#x09;image\_url - varchar

&#x09;campus\_id - int



Facilities:

&#x09;name - varchar

&#x09;type - varchar

&#x09;department\_id - varchar



Photos:

&#x09;deparment\_id - int

&#x09;image\_url - varchar

&#x09;type - varchar(it could be the facilities images or department image)

event\_Photos:

&#x09;event\_id - int

&#x09;image\_url - varchar

&#x09;type - varchar



Program/courses:

&#x09;description\_name - varchar

&#x09;code\_name - varchar

&#x09;department\_id - int

&#x09;image\_url - varchar



heads/officers: 

&#x09;fullname - varchar

&#x09;position - varchar

&#x09;department\_id - int

&#x09;image\_url - varchar



EVENTS:

&#x09;name - varchar

&#x09;about - varchar

&#x09;start\_date - date

&#x09;sEND\_date - date

&#x09;start\_time - varchar

&#x09;end\_time - varchar

&#x09;venue - varchar

&#x09;department\_id - int

&#x09;event\_organizer\_name - varchar

&#x09;event\_organizer\_image\_url - varchar





OFFICES:

&#x09;campus\_id - int 

&#x09;name - varchar

&#x09;about - varchar



offices\_photos:

&#x09;offices\_id - int

&#x09;type - varchar(poster, promotial)

&#x09;image\_url - varchar





navigation:

&#x09;node\_id - int(this is the id of  events, offices,deparatment

&#x09;type - varchar(this is the events, offices,deparatment)

&#x09;image\_url - varchar

&#x09;directional\_text - varchar



&#x09;

