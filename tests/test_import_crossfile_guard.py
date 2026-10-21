"""Regression tests: safe import dedupe across CSVs, no historical deletion."""
import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import process_import_requests as imp

BASE={"year":"2024","season":"autumn","region":"北信越","prefecture":"富山",
"tournament":"秋季富山県大会","round":"準決勝","date":"2024-09-20",
"team1":"A高校","score1":"3","team2":"B高校","score2":"2",
"source_url":"https://koshien89.com/blog-entry-999.html","note":"level=prefecture"}

class GuardTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.root=Path(self.tmp.name)
  self.patch=patch.object(imp,"DATA_ROOT",self.root)
  self.patch.start()
  imp._IMPORT_IDENTITIES=None
  imp._IMPORT_SKIPPED=0
 def tearDown(self):
  self.patch.stop()
  self.tmp.cleanup()
 def test_crossfile_same_source_identical_game_skipped(self):
  p1=self.root/"2024/autumn/富山.csv"
  p2=self.root/"2024/autumn/東京.csv"
  a,_,_=imp.merge_csv(p1,[BASE.copy()])
  r=dict(BASE,prefecture="東京",tournament="秋季東京大会",round="3回戦",team1="B高校",score1="2",team2="A高校",score2="3")
  b,_,_=imp.merge_csv(p2,[r])
  self.assertEqual((a,b),(1,0))
  self.assertFalse(p2.read_text(encoding="utf-8-sig").count("B高校"))
  self.assertEqual(len(list(csv.DictReader(p1.open(encoding="utf-8-sig")))),1)
 def test_other_source_or_score_kept(self):
  p=self.root/"2024/autumn/富山.csv"
  a,_,_=imp.merge_csv(p,[BASE.copy()])
  different_source=dict(BASE,source_url="https://koshien89.com/blog-entry-998.html",tournament="別大会")
  different_score=dict(BASE,score1="4",tournament="スコア矛盾候補")
  b,_,_=imp.merge_csv(p,[different_source,different_score])
  self.assertEqual((a,b),(1,2))
 def test_walkoff_2x_scoreline_parses(self):
  parsed=imp.koshien89_match_line("■中京 2x-1 岐阜第一")
  self.assertIsNotNone(parsed)
  self.assertEqual((parsed["team1"],parsed["score1"],parsed["team2"],parsed["score2"]),("中京",2,"岐阜第一",1))

 def test_numeric_zero_scores_are_identifiable_and_deduped(self):
  p1=self.root/"2024/autumn/三重.csv"
  p2=self.root/"2024/autumn/東京.csv"
  first=dict(BASE,score1=0,score2=7)
  second=dict(first,prefecture="東京",tournament="誤った東京大会",round="別回戦")
  self.assertIsNotNone(imp._import_identity(first))
  self.assertEqual(imp.merge_csv(p1,[first])[0],1)
  self.assertEqual(imp.merge_csv(p2,[second])[0],0)

 def test_reimport_same_file_skipped(self):
  p=self.root/"2024/autumn/富山.csv"
  self.assertEqual(imp.merge_csv(p,[BASE.copy()])[0],1)
  self.assertEqual(imp.merge_csv(p,[BASE.copy()])[0],0)

if __name__=="__main__":unittest.main()
