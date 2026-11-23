# pi-reflag 本地分支记录

- 来源：`npm:@piotr-oles/pi-reflag@1.2.0`（上游 https://github.com/piotr-oles/pi-extensions ，`packages/pi-reflag`）
- 复制日期：2026-11-23
- 本地版本：`1.2.1-local.3`（`package.json`）
- 加载：用户级 `~/.pi/agent/settings.json` 的 `packages` 用本地路径指向本目录；`node_modules/web-tree-sitter@0.26.13` 随包携带（本地包不会被 pi 装依赖）。

## 本地改动

`src/find.ts` 同样重写为一**张单 flag 映射表**，覆盖 GNU findutils 4.10 `--help` 全部 flag（短/长同名），每项独立查表：

- 映射：`-name/-iname`→`-g`（多个合并 `{a,b}`）、`-path/-wholename/-ipath/-iwholename`→`-p`、`-regex/-iregex`→位置正则、`-not`/`!` 与 `-prune`→`-E`、`-maxdepth/-mindepth/-type/-size/-mtime/-mmin/-newer/-user/-uid/-group/-gid/-empty/-executable/-print0/-exec/-execdir/-quit/-ls/-mount/-xdev` 等。
- 无 fd 对应、整条**不改写**保持 find 原样：`-perm`、`-delete`、`-printf`、`-atime*`/`-ctime*`（fd 只有 mtime）、`-lname`、`-fstype`、`-context`、`-regextype`、`-D`/`-O`、`--help`/`--version`、未知 flag；`find -Olevel -D` 这类前置选项直接不改写。
- 安全兜底：大小写模式混用、`-t`/`--owner` 重复（fd 是 OR，find 是 AND）、多个正则、逗号运算符、glob 里含逗号时不改写。find `-size M/G`→fd `mi/gi`、`c`→`b`；无单位或 `k/w/b` 不改写（512 字节块语义不同）。
- `check-find.mjs`：19 条翻译断言，`node --no-warnings --experimental-strip-types vendor/pi-reflag/check-find.mjs`（Node ≥22.6）。

`src/grep.ts` 重写为一**张单 flag 映射表**

- 命令：`grep` `egrep` `fgrep` `zgrep` `zegrep` `zfgrep` `bzgrep` `xzgrep`（后四类前缀 `-z`，`egrep` 按 ERE、`fgrep` 按固定串预设）。`xargs grep ...` 仍由 `xargs.ts` 包装处理。
- 关键纠偏：grep `-h`→rg `-I`（rg `-h` 是 help）、grep `-z`→`--null-data`（rg `-z` 是 zip）、grep `-L`→`--files-without-match`（rg `-L` 是 follow symlinks）、grep `-U`→`--crlf`、`--color=WHEN` 保留 WHEN。
- 近似映射：`--exclude-from=FILE`→rg `--ignore-file`（前者每行一个 glob，后者 gitignore 语法）；grep `-U`→`--crlf`。
- 无 rg 对应、整条命令**不改写**保持 grep 原样：`-V`/`--version`、`--help`、`-T`/`--initial-tab`、`-u`、`-d`/`--directories`、`-D`/`--devices`、`--label`、未知 flag。

## 更新 / 合并上游

```bash
# 覆盖上游 src 与 vendor，保留本目录的 package.json / node_modules / UPSTREAM.md
cd /tmp && git clone --depth 1 https://github.com/piotr-oles/pi-extensions.git
cp -r pi-extensions/packages/pi-reflag/src "D:/AI/pi插件安装清单/vendor/pi-reflag/"
cp -r pi-extensions/packages/pi-reflag/vendor "D:/AI/pi插件安装清单/vendor/pi-reflag/"

# 重放本地改动：src/grep.ts 和 src/find.ts 换成本分支版本，取回 check-find.mjs，递增 package.json 的 local 版本号
# 上游若已覆盖上述 flag 与命令族，可直接用上游版本并删掉本记录
```

## 验证（两条命令）

```bash
cd "D:/AI/pi插件安装清单"
mkdir -p /tmp/reflag-probe && printf "MARKER\n" > /tmp/reflag-probe/a.txt && printf "nothing\n" > /tmp/reflag-probe/b.txt
PATH="$HOME/.pi/agent/bin:$PATH" pi --no-extensions -e builtin:codemode -e "$PWD/vendor/pi-reflag" \
  --tools "read,bash,edit,write,codemode" --no-session --no-skills --no-mcp \
  -p "Call the codemode tool with this exact code and nothing else: const r = await tools.bash({command: 'grep -rIc MARKER /tmp/reflag-probe'}); text(r.output);"
```

期望输出含 `b.txt:0`（rg 的 `--include-zero`）；若只输出 `a.txt:1` 或 GNU grep 报错，说明补丁没加载。

全 flag 映射可用一次性扩展在 `session_start` 里对 `grep` rewrite 断言，例如 `grep -rIl --exclude-dir=.git -E 'a|b' .` → `rg -l -g '!.git/' 'a|b' .`、`fgrep` → `rg -F`、`egrep` → `rg`、`grep -V` → 不改写。

find 翻译断言（无需 pi）：

```bash
node --no-warnings --experimental-strip-types "D:/AI/pi插件安装清单/vendor/pi-reflag/check-find.mjs"
```

改完 `/reload`（或新开会话）生效。
