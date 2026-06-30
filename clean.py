import sqlite3
c = sqlite3.connect("stations.db")
c.execute("DELETE FROM stations WHERE brand = '' OR name = ''")
c.commit()
print("Cleaned!")
