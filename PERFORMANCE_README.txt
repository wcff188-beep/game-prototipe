VICE CITY RP V19 — ONESTATE ENGINE EDITION (WEB-READY & INSTANCED 3D)

Peningkatan Performa & Arsitektur Ala OneState RP:
1. GPU Instancing (THREE.InstancedMesh): Ratusan pohon palem, pohon kota, tiang lampu jalan, pot bunga, bangku taman, dan hidran digabung menjadi hanya beberapa Draw Call ke GPU (memangkas beban CPU hingga 70%).
2. Dynamic Building Streaming (Distance Culling): Gedung yang berada di luar jarak pandang kabut (310m) otomatis dinonaktifkan dari pipeline render seperti sistem streaming kota di OneState RP.
3. Camera Far-Plane & Fog Horizon Optimization: Jarak render kamera diselaraskan dengan kabut atmosfer (340m) agar GPU tidak membuang tenaga merender objek jauh yang tertutup kabut.
4. Paket Web-Ready (~4,7 MB): File tekstur mentah yang tidak terpakai telah dibersihkan sehingga siap langsung di-upload ke GitHub Pages, Netlify Drop, atau Vercel dengan waktu loading super cepat.
