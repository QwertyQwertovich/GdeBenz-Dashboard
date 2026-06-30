import sqlite3
c = sqlite3.connect("stations.db")
c.execute("UPDATE stations SET region = 'Донецкая область' WHERE region = 'ДНР'")
c.execute("UPDATE stations SET region = 'Луганская область' WHERE region = 'ЛНР'")
c.commit()
print("Renamed in DB")
