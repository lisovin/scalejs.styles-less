param($installPath, $toolsPath, $package, $project)

$project | 
	Remove-Paths 'styles,less,lessc,less-builder,normalize' |
	Out-Null

