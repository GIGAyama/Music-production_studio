lamejs 1.2.1 — MP3 encoder in JavaScript (a port of LAME)

  Copyright (c) Alex Zhukov and the lamejs contributors
  LAME: Copyright (c) The LAME Project  https://lame.sourceforge.io/
  Source: https://github.com/zhuker/lamejs   (npm: lamejs@1.2.1)

License: GNU Lesser General Public License v3.0 (LGPL-3.0)
  COPYING.LESSER … LGPL-3.0 の全文（GPL-3.0 の全文をふくむ）
  COPYING        … GPL-3.0 の全文

このフォルダの lame.min.js は、npm の lamejs@1.2.1 に入っているものを
1 バイトも変えずに置いたものです（tools/vendor-lamejs.mjs が写します）。
音楽制作スタジオは「MP3出力」を押したときにだけ、このファイルを別の
スクリプトとして読みこみます。アプリ本体の JavaScript には混ぜていません。

lame.min.js を別の版に差し替えたい方は、このファイルを置きかえるだけで
動きます（window.lamejs.Mp3Encoder を使っています）。
元のソースコードは上の Source から入手できます。
