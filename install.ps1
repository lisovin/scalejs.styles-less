param($installPath, $toolsPath, $package, $project)

$project | 
	Add-Paths "{
		'less'			: 'Scripts/less',
		'less-builder'	: 'Scripts/less-builder',
		'lessc'			: 'Scripts/lessc',
		'normalize'		: 'Scripts/normalize',
		'styles'		: 'Scripts/scalejs.styles'
	}" |
	Out-Null
